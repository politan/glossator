import { normalizeDetected, type LanguageCode } from './languages';

export const MAX_SELECTION_LENGTH = 4000;

export interface LanguagePrefs {
  /** A language code, or `'auto'` for Auto. */
  source: string;
  target: LanguageCode;
  fallback: LanguageCode;
}

export interface LanguagePair {
  /** Null when the Source Language is Auto and nothing reliable was detected. */
  source: LanguageCode | null;
  target: LanguageCode;
}

export function resolveLanguagePair(prefs: LanguagePrefs, detected: string | null): LanguagePair {
  if (prefs.source !== 'auto') return { source: prefs.source, target: prefs.target };
  const source = detected ? normalizeDetected(detected) : null;
  if (source === prefs.target) return { source, target: prefs.fallback };
  return { source, target: prefs.target };
}

export function swapLanguagePair(prefs: LanguagePrefs): LanguagePrefs {
  if (prefs.source === 'auto') return { ...prefs, target: prefs.fallback, fallback: prefs.target };
  return { ...prefs, source: prefs.target, target: prefs.source };
}

export function isSelectionTooLong(text: string): boolean {
  return text.trim().length > MAX_SELECTION_LENGTH;
}
