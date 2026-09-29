import { browser } from 'wxt/browser';
import type { TranslateEvent, TranslateRequest } from './messages';
import { isSelectionTooLong, resolveLanguagePair, type LanguagePair } from './pair';
import { buildMessages, resolvePromptProfile } from './prompts/profiles';
import { privacyOf } from './providers/privacy';
import type { Provider } from './providers/types';
import { activeProvider, loadPrefs, providerName, providersItem } from './settings';
import { TranslationError, streamTranslation } from './translation/client';

const CACHE_LIMIT = 100;
// Session-only cache so re-selecting the same text costs nothing. Never persisted.
const cache = new Map<string, string>();

/**
 * Runs one Translation for the Bubble and reports progress through `emit`.
 * Resolves when the Translation finished, failed or was aborted.
 */
export async function runTranslation(
  request: TranslateRequest,
  emit: (event: TranslateEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const settings = await providersItem.getValue();
  const cloudAvailable = Boolean(settings.cloud.apiKey);
  const provider = request.viaCloud
    ? cloudAvailable
      ? settings.cloud
      : null
    : activeProvider(settings);
  const fail = (code: Extract<TranslateEvent, { type: 'error' }>['code'], detail?: string) => {
    emit({
      type: 'error',
      code,
      detail,
      cloudAvailable: cloudAvailable && provider?.kind === 'local',
    });
  };

  const text = request.text.trim();
  if (!provider) {
    fail('not-configured');
    return;
  }
  if (!text || isSelectionTooLong(text)) {
    fail(text ? 'too-long' : 'empty');
    return;
  }

  const prefs = await loadPrefs();
  const detected = prefs.source === 'auto' ? await detectLanguage(text) : null;
  // A Target Language picked in the Bubble is meant literally, so it also serves as the fallback.
  const pair = resolveLanguagePair(
    request.target ? { ...prefs, target: request.target, fallback: request.target } : prefs,
    detected,
  );
  const profile = resolvePromptProfile(provider.model, provider.promptProfile);
  const context = prefs.useSurroundingContext ? request.context : null;

  emit({
    type: 'meta',
    privacy: privacyOf(provider),
    providerName: providerName(provider),
    model: provider.model,
    profile,
    pair,
  });

  const key = cacheKey(provider, profile, pair, text, context);
  const cached = cache.get(key);
  if (cached !== undefined) {
    emit({ type: 'delta', text: cached });
    emit({ type: 'done' });
    return;
  }

  const messages = buildMessages(profile, {
    text,
    source: pair.source,
    target: pair.target,
    ...(context ? { context } : {}),
  });
  let translation = '';
  try {
    for await (const piece of streamTranslation(provider, messages, { signal })) {
      translation += piece;
      emit({ type: 'delta', text: piece });
    }
  } catch (error) {
    const failure =
      error instanceof TranslationError ? error : new TranslationError('unknown', String(error));
    fail(failure.code, failure.detail);
    return;
  }
  if (signal.aborted) return;
  remember(key, translation.trim());
  emit({ type: 'done' });
}

async function detectLanguage(text: string): Promise<string | null> {
  try {
    const result = await browser.i18n.detectLanguage(text);
    const top = result.languages[0];
    return result.isReliable && top ? top.language : null;
  } catch {
    return null;
  }
}

function cacheKey(
  provider: Provider,
  profile: string,
  pair: LanguagePair,
  text: string,
  context: string | null,
): string {
  return JSON.stringify([provider.id, provider.model, profile, pair, text, context]);
}

function remember(key: string, translation: string): void {
  if (!translation) return;
  cache.set(key, translation);
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}
