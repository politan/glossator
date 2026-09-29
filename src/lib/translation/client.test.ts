import { describe, expect, it } from 'vitest';
import type { CloudProvider, LocalProvider } from '../providers/types';
import { TranslationError, checkOpenRouterKey, listModels, streamTranslation } from './client';
import { delta, fakeFetch, hangingFetch, jsonResponse, sseResponse } from './test-helpers';

const openRouter: CloudProvider = {
  kind: 'cloud',
  id: 'openrouter',
  apiKey: 'sk-or-test',
  model: 'tencent/hy-mt2-30b-a3b',
  promptProfile: 'auto',
  strictPrivacy: true,
};

const ollama: LocalProvider = {
  kind: 'local',
  id: 'local-1',
  name: 'Ollama',
  preset: 'ollama',
  baseUrl: 'http://127.0.0.1:11434/v1',
  apiKey: '',
  model: 'translategemma:4b',
  promptProfile: 'auto',
};

const messages = [{ role: 'user' as const, content: 'Translate: hello' }];

async function collect(stream: AsyncIterable<string>): Promise<string> {
  let out = '';
  for await (const piece of stream) out += piece;
  return out;
}

describe('streamTranslation', () => {
  it('yields the Translation as it streams, even when events are split across chunks', async () => {
    const event = delta('Dzień');
    const { fetch } = fakeFetch(
      sseResponse([
        ': OPENROUTER PROCESSING\n\n',
        event.slice(0, 20),
        event.slice(20),
        delta(' dobry'),
        'data: [DONE]\n\n',
      ]),
    );
    const pieces: string[] = [];
    for await (const piece of streamTranslation(openRouter, messages, { fetch }))
      pieces.push(piece);
    expect(pieces).toEqual(['Dzień', ' dobry']);
  });

  it('calls OpenRouter with the key, attribution headers and Strict Privacy Routing', async () => {
    const { fetch, requests } = fakeFetch(sseResponse(['data: [DONE]\n\n']));
    await collect(streamTranslation(openRouter, messages, { fetch }));
    const [request] = requests;
    expect(request?.url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(request?.method).toBe('POST');
    expect(request?.headers).toMatchObject({
      authorization: 'Bearer sk-or-test',
      'http-referer': 'https://github.com/politan/glossa',
      'x-title': 'Glossa',
    });
    expect(request?.body).toMatchObject({
      model: 'tencent/hy-mt2-30b-a3b',
      messages,
      stream: true,
      provider: { data_collection: 'deny', zdr: true },
    });
  });

  it('drops the privacy routing flags when Strict Privacy Routing is off', async () => {
    const { fetch, requests } = fakeFetch(sseResponse(['data: [DONE]\n\n']));
    await collect(streamTranslation({ ...openRouter, strictPrivacy: false }, messages, { fetch }));
    const body = requests[0]?.body as { provider?: Record<string, unknown> };
    expect(body.provider?.data_collection).toBeUndefined();
    expect(body.provider?.zdr).toBeUndefined();
  });

  it('keeps Gemma away from Google-operated upstreams', async () => {
    const { fetch, requests } = fakeFetch(sseResponse(['data: [DONE]\n\n']));
    await collect(
      streamTranslation({ ...openRouter, model: 'google/gemma-4-31b-it' }, messages, { fetch }),
    );
    expect(requests[0]?.body).toMatchObject({
      provider: { ignore: ['google-vertex', 'google-ai-studio'] },
    });
  });

  it('calls a Local Provider at its own address without sending OpenRouter headers', async () => {
    const { fetch, requests } = fakeFetch(sseResponse([delta('Cześć'), 'data: [DONE]\n\n']));
    expect(await collect(streamTranslation(ollama, messages, { fetch }))).toBe('Cześć');
    const [request] = requests;
    expect(request?.url).toBe('http://127.0.0.1:11434/v1/chat/completions');
    expect(request?.headers.authorization).toBeUndefined();
    expect(request?.headers['http-referer']).toBeUndefined();
    expect(request?.body).not.toHaveProperty('provider');
  });

  it('sends the key to a Local Provider that requires one', async () => {
    const { fetch, requests } = fakeFetch(sseResponse(['data: [DONE]\n\n']));
    await collect(streamTranslation({ ...ollama, apiKey: 'lm-key' }, messages, { fetch }));
    expect(requests[0]?.headers.authorization).toBe('Bearer lm-key');
  });
});

describe('streamTranslation reasoning', () => {
  it('asks general models on OpenRouter for minimal, hidden reasoning', async () => {
    const { fetch, requests } = fakeFetch(sseResponse(['data: [DONE]\n\n']));
    await collect(
      streamTranslation({ ...openRouter, model: 'google/gemma-4-31b-it' }, messages, { fetch }),
    );
    expect(requests[0]?.body).toMatchObject({ reasoning: { effort: 'minimal', exclude: true } });
  });

  it('sends no reasoning settings to dedicated translation models', async () => {
    const { fetch, requests } = fakeFetch(sseResponse(['data: [DONE]\n\n']));
    await collect(streamTranslation(openRouter, messages, { fetch }));
    expect(requests[0]?.body).not.toHaveProperty('reasoning');
  });

  it('never shows reasoning deltas', async () => {
    const reasoning = `data: ${JSON.stringify({ choices: [{ delta: { reasoning: 'hmm', reasoning_content: 'hmm' } }] })}\n\n`;
    const { fetch } = fakeFetch(sseResponse([reasoning, delta('Cześć'), 'data: [DONE]\n\n']));
    expect(await collect(streamTranslation(ollama, messages, { fetch }))).toBe('Cześć');
  });

  it('strips a leading <think> block, even when its tags are split across events', async () => {
    const { fetch } = fakeFetch(
      sseResponse([
        delta('<thi'),
        delta('nk>Polish, so'),
        delta(' plain.</th'),
        delta('ink>\n\nCześć'),
        delta('!'),
      ]),
    );
    expect(await collect(streamTranslation(ollama, messages, { fetch }))).toBe('Cześć!');
  });

  it('keeps text that merely mentions a tag later on', async () => {
    const { fetch } = fakeFetch(sseResponse([delta('Use <think> here')]));
    expect(await collect(streamTranslation(ollama, messages, { fetch }))).toBe('Use <think> here');
  });
});

describe('streamTranslation errors', () => {
  async function failure(
    provider: Parameters<typeof streamTranslation>[0],
    response: Response | Error,
  ) {
    const { fetch } = fakeFetch(response);
    try {
      await collect(streamTranslation(provider, messages, { fetch }));
    } catch (error) {
      return error;
    }
    throw new Error('expected the stream to fail');
  }

  it.each([
    [401, 'unauthorized'],
    [402, 'insufficient-credits'],
    [404, 'model-not-found'],
    [408, 'timeout'],
    [429, 'rate-limited'],
    [502, 'unavailable'],
    [503, 'unavailable'],
    [400, 'bad-request'],
    [500, 'unknown'],
  ] as const)('maps HTTP %i to %s', async (status, code) => {
    const error = await failure(
      openRouter,
      jsonResponse(status, { error: { code: status, message: 'upstream said no' } }),
    );
    expect(error).toBeInstanceOf(TranslationError);
    expect(error).toMatchObject({ code, detail: 'upstream said no' });
  });

  it('reads plain-string errors from local servers', async () => {
    const error = await failure(ollama, jsonResponse(404, { error: "model 'x' not found" }));
    expect(error).toMatchObject({ code: 'model-not-found', detail: "model 'x' not found" });
  });

  it('reports a rejected Origin from a local server as its own problem', async () => {
    const error = await failure(ollama, new Response('', { status: 403 }));
    expect(error).toMatchObject({ code: 'origin-rejected' });
  });

  it('reports an unreachable server', async () => {
    const error = await failure(ollama, new TypeError('Failed to fetch'));
    expect(error).toMatchObject({ code: 'unreachable' });
  });

  it('fails on an error event in the middle of the stream, after what arrived so far', async () => {
    const { fetch } = fakeFetch(
      sseResponse([
        delta('Dzień'),
        `data: ${JSON.stringify({ error: { code: 502, message: 'provider went away' }, choices: [{ delta: { content: '' }, finish_reason: 'error' }] })}\n\n`,
      ]),
    );
    const pieces: string[] = [];
    await expect(async () => {
      for await (const piece of streamTranslation(openRouter, messages, { fetch }))
        pieces.push(piece);
    }).rejects.toMatchObject({ code: 'unavailable', detail: 'provider went away' });
    expect(pieces).toEqual(['Dzień']);
  });

  it('times out when the first token takes too long', async () => {
    const hanging = hangingFetch();
    await expect(
      collect(streamTranslation(ollama, messages, { fetch: hanging, firstTokenTimeoutMs: 10 })),
    ).rejects.toMatchObject({ code: 'timeout' });
  });

  it('stops quietly when the caller aborts', async () => {
    const controller = new AbortController();
    const hanging = hangingFetch();
    const run = collect(
      streamTranslation(ollama, messages, { fetch: hanging, signal: controller.signal }),
    );
    controller.abort();
    await expect(run).resolves.toBe('');
  });
});

describe('listModels', () => {
  it('lists the model ids a Local Provider serves', async () => {
    const { fetch, requests } = fakeFetch(
      jsonResponse(200, {
        object: 'list',
        data: [{ id: 'translategemma:4b' }, { id: 'qwen3.5:9b' }],
      }),
    );
    expect(await listModels(ollama, { fetch })).toEqual(['translategemma:4b', 'qwen3.5:9b']);
    expect(requests[0]?.url).toBe('http://127.0.0.1:11434/v1/models');
  });

  it('reports an unreachable server', async () => {
    const { fetch } = fakeFetch(new TypeError('Failed to fetch'));
    await expect(listModels(ollama, { fetch })).rejects.toMatchObject({ code: 'unreachable' });
  });
});

describe('checkOpenRouterKey', () => {
  it('returns the remaining credit of a valid key', async () => {
    const { fetch, requests } = fakeFetch(
      jsonResponse(200, {
        data: { label: 'sk-or-v1-abc', usage: 1.25, limit: 10, limit_remaining: 8.75 },
      }),
    );
    expect(await checkOpenRouterKey('sk-or-test', { fetch })).toEqual({
      limitRemaining: 8.75,
      usage: 1.25,
    });
    expect(requests[0]).toMatchObject({
      url: 'https://openrouter.ai/api/v1/key',
      headers: { authorization: 'Bearer sk-or-test' },
    });
  });

  it('treats a key without a spending limit as having no limit', async () => {
    const { fetch } = fakeFetch(
      jsonResponse(200, { data: { usage: 0, limit: null, limit_remaining: null } }),
    );
    expect(await checkOpenRouterKey('sk-or-test', { fetch })).toEqual({
      limitRemaining: null,
      usage: 0,
    });
  });

  it('rejects an invalid key', async () => {
    const { fetch } = fakeFetch(
      jsonResponse(401, { error: { code: 401, message: 'No auth credentials found' } }),
    );
    await expect(checkOpenRouterKey('bad', { fetch })).rejects.toMatchObject({
      code: 'unauthorized',
    });
  });
});
