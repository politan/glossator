import { profileOf, type ChatMessage } from '../prompts/profiles';
import {
  OPENROUTER_ATTRIBUTION,
  OPENROUTER_BASE_URL,
  upstreamsToIgnore,
} from '../providers/openrouter';
import type { LocalProvider, Provider } from '../providers/types';

export type TranslationErrorCode =
  | 'unauthorized'
  | 'insufficient-credits'
  | 'moderation'
  | 'origin-rejected'
  | 'model-not-found'
  | 'timeout'
  | 'rate-limited'
  | 'unavailable'
  | 'bad-request'
  | 'unreachable'
  | 'unknown';

export class TranslationError extends Error {
  constructor(
    readonly code: TranslationErrorCode,
    readonly detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'TranslationError';
  }
}

export interface RequestOptions {
  signal?: AbortSignal;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export interface StreamOptions {
  signal?: AbortSignal;
  fetch?: typeof fetch;
  /**
   * How long the stream may stay silent, including before the first token.
   * Local servers may need a while to load the model first.
   */
  idleTimeoutMs?: number;
}

const IDLE_TIMEOUT_MS = { cloud: 30_000, local: 120_000 };
const REQUEST_TIMEOUT_MS = 10_000;

export async function* streamTranslation(
  provider: Provider,
  messages: ChatMessage[],
  options: StreamOptions = {},
): AsyncGenerator<string> {
  const doFetch = options.fetch ?? fetch;
  const controller = new AbortController();
  const forwardAbort = () => {
    controller.abort(options.signal?.reason);
  };
  options.signal?.addEventListener('abort', forwardAbort);
  const idleMs = options.idleTimeoutMs ?? IDLE_TIMEOUT_MS[provider.kind];
  let timer: ReturnType<typeof setTimeout> | undefined;
  const restartTimer = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      controller.abort(new TranslationError('timeout'));
    }, idleMs);
  };
  restartTimer();
  const filter = new ThinkFilter();

  try {
    const response = await doFetch(`${baseUrlOf(provider)}/chat/completions`, {
      method: 'POST',
      headers: headersFor(provider),
      body: JSON.stringify(bodyFor(provider, messages)),
      signal: controller.signal,
    });
    if (!response.ok) throw await errorFromResponse(response, provider);
    if (!response.body) return;

    for await (const data of sseData(response.body, controller.signal)) {
      restartTimer();
      if (data === '[DONE]') break;
      const event = JSON.parse(data) as StreamEvent;
      if (event.error)
        throw new TranslationError(codeForStatus(event.error.code), event.error.message);
      const content = event.choices?.[0]?.delta?.content;
      if (!content) continue;
      const visible = filter.push(content);
      if (visible) yield visible;
    }
    // Cancelling a stalled body ends it like a normal close, so check why it ended.
    controller.signal.throwIfAborted();
    const rest = filter.flush();
    if (rest) yield rest;
  } catch (error) {
    if (options.signal?.aborted) return;
    if (controller.signal.reason instanceof TranslationError) throw controller.signal.reason;
    throw asTranslationError(error);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', forwardAbort);
  }
}

export async function listModels(
  provider: LocalProvider,
  options: RequestOptions = {},
): Promise<string[]> {
  const response = await request(`${baseUrlOf(provider)}/models`, provider, options);
  const body = (await response.json()) as { data?: { id: string }[] };
  return (body.data ?? []).map((model) => model.id);
}

export interface OpenRouterKeyStatus {
  /** Remaining credit in USD, or null when the key has no spending limit. */
  limitRemaining: number | null;
  usage: number;
}

export async function checkOpenRouterKey(
  apiKey: string,
  options: RequestOptions = {},
): Promise<OpenRouterKeyStatus> {
  const provider = { kind: 'cloud', apiKey } as const;
  const response = await request(`${OPENROUTER_BASE_URL}/key`, provider, options);
  const { data } = (await response.json()) as {
    data: { usage: number; limit_remaining: number | null };
  };
  return { limitRemaining: data.limit_remaining, usage: data.usage };
}

async function request(
  url: string,
  provider: Pick<Provider, 'kind' | 'apiKey'>,
  options: RequestOptions,
): Promise<Response> {
  const doFetch = options.fetch ?? fetch;
  const timeout = new TranslationError('timeout');
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(timeout);
  }, options.timeoutMs ?? REQUEST_TIMEOUT_MS);
  const signal = options.signal
    ? AbortSignal.any([options.signal, controller.signal])
    : controller.signal;
  let response: Response;
  try {
    response = await doFetch(url, { headers: headersFor(provider), signal });
  } catch (error) {
    throw controller.signal.aborted ? timeout : asTranslationError(error);
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) throw await errorFromResponse(response, provider);
  return response;
}

interface StreamEvent {
  error?: { code: number; message?: string };
  choices?: { delta?: { content?: string | null } }[];
}

function baseUrlOf(provider: Provider): string {
  return provider.kind === 'cloud' ? OPENROUTER_BASE_URL : provider.baseUrl.replace(/\/+$/, '');
}

function headersFor(provider: Pick<Provider, 'kind' | 'apiKey'>): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (provider.apiKey) headers.Authorization = `Bearer ${provider.apiKey}`;
  if (provider.kind === 'cloud') Object.assign(headers, OPENROUTER_ATTRIBUTION);
  return headers;
}

function bodyFor(provider: Provider, messages: ChatMessage[]): Record<string, unknown> {
  const body: Record<string, unknown> = { model: provider.model, messages, stream: true };
  if (provider.kind === 'cloud') {
    const routing: Record<string, unknown> = {};
    if (provider.strictPrivacy) Object.assign(routing, { data_collection: 'deny', zdr: true });
    const ignore = upstreamsToIgnore(provider.model);
    if (ignore.length > 0) routing.ignore = ignore;
    body.provider = routing;
    // Local servers disagree on how to turn thinking off, so there we only hide it.
    if (profileOf(provider) === 'generic') {
      body.reasoning = { effort: 'minimal', exclude: true };
    }
  }
  return body;
}

async function errorFromResponse(
  response: Response,
  provider: Pick<Provider, 'kind'>,
): Promise<TranslationError> {
  const detail = await errorDetail(response);
  if (response.status === 403) {
    // Ollama answers 403 to an Origin it does not allow (ADR 0003).
    return new TranslationError(
      provider.kind === 'local' ? 'origin-rejected' : 'moderation',
      detail,
    );
  }
  return new TranslationError(codeForStatus(response.status), detail);
}

async function errorDetail(response: Response): Promise<string | undefined> {
  const text = await response.text().catch(() => '');
  try {
    const { error } = JSON.parse(text) as { error?: string | { message?: string } };
    return typeof error === 'string' ? error : error?.message;
  } catch {
    return text || undefined;
  }
}

function codeForStatus(status: number): TranslationErrorCode {
  switch (status) {
    case 400:
      return 'bad-request';
    case 401:
      return 'unauthorized';
    case 402:
      return 'insufficient-credits';
    case 403:
      return 'moderation';
    case 404:
      return 'model-not-found';
    case 408:
    case 504:
      return 'timeout';
    case 429:
      return 'rate-limited';
    case 502:
    case 503:
      return 'unavailable';
    default:
      return 'unknown';
  }
}

function asTranslationError(error: unknown): TranslationError {
  if (error instanceof TranslationError) return error;
  if (error instanceof TypeError) return new TranslationError('unreachable', error.message);
  return new TranslationError('unknown', error instanceof Error ? error.message : String(error));
}

/** Yields the payload of each `data:` line of a server-sent event stream. */
async function* sseData(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
): AsyncGenerator<string> {
  const reader = body.getReader();
  // A stalled body never settles read(), so cancel it when the request is aborted.
  const cancel = () => {
    reader.cancel(signal.reason).catch(() => undefined);
  };
  signal.addEventListener('abort', cancel);
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newline).trimEnd();
        buffer = buffer.slice(newline + 1);
        if (line.startsWith('data:')) yield line.slice(5).trimStart();
      }
    }
  } finally {
    signal.removeEventListener('abort', cancel);
    reader.releaseLock();
  }
}

const OPEN_TAG = '<think>';
const CLOSE_TAG = '</think>';

/**
 * Removes a reasoning block some local models put at the very start of their
 * answer. Only a leading block is removed so a Translation that happens to
 * contain the tag is left alone.
 */
class ThinkFilter {
  private state: 'start' | 'thinking' | 'after' | 'pass' = 'start';
  private buffer = '';

  push(piece: string): string {
    if (this.state === 'pass') return piece;
    this.buffer += piece;

    if (this.state === 'start') {
      const trimmed = this.buffer.trimStart();
      if (trimmed.length < OPEN_TAG.length && OPEN_TAG.startsWith(trimmed)) return '';
      if (!trimmed.startsWith(OPEN_TAG)) return this.release();
      this.state = 'thinking';
      this.buffer = trimmed.slice(OPEN_TAG.length);
    }

    if (this.state === 'thinking') {
      const end = this.buffer.indexOf(CLOSE_TAG);
      if (end === -1) {
        this.buffer = this.buffer.slice(-CLOSE_TAG.length);
        return '';
      }
      this.buffer = this.buffer.slice(end + CLOSE_TAG.length);
      this.state = 'after';
    }

    const answer = this.buffer.trimStart();
    this.buffer = '';
    if (answer) this.state = 'pass';
    return answer;
  }

  flush(): string {
    return this.state === 'start' ? this.release() : '';
  }

  private release(): string {
    const out = this.buffer;
    this.buffer = '';
    this.state = 'pass';
    return out;
  }
}
