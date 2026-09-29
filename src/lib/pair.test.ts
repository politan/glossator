import { describe, expect, it } from 'vitest';
import {
  MAX_SELECTION_LENGTH,
  isSelectionTooLong,
  resolveLanguagePair,
  swapLanguagePair,
} from './pair';

describe('resolveLanguagePair', () => {
  it('uses a concrete Source Language as-is, whatever was detected', () => {
    expect(resolveLanguagePair({ source: 'en', target: 'pl', fallback: 'en' }, 'de')).toEqual({
      source: 'en',
      target: 'pl',
    });
  });

  it('takes the detected language as the source when set to Auto', () => {
    expect(resolveLanguagePair({ source: 'auto', target: 'pl', fallback: 'en' }, 'en')).toEqual({
      source: 'en',
      target: 'pl',
    });
  });

  it('switches to the Fallback Language when the Selection is already in the Target Language', () => {
    expect(resolveLanguagePair({ source: 'auto', target: 'pl', fallback: 'en' }, 'pl')).toEqual({
      source: 'pl',
      target: 'en',
    });
  });

  it('leaves the source unknown when nothing reliable was detected', () => {
    expect(resolveLanguagePair({ source: 'auto', target: 'pl', fallback: 'en' }, null)).toEqual({
      source: null,
      target: 'pl',
    });
  });

  it('keeps Traditional and Simplified Chinese apart', () => {
    expect(
      resolveLanguagePair({ source: 'auto', target: 'zh', fallback: 'en' }, 'zh-Hant'),
    ).toEqual({
      source: 'zh-Hant',
      target: 'zh',
    });
  });

  it('matches a regional detection to its base language', () => {
    expect(resolveLanguagePair({ source: 'auto', target: 'pt', fallback: 'en' }, 'pt-BR')).toEqual({
      source: 'pt',
      target: 'en',
    });
  });
});

describe('swapLanguagePair', () => {
  it('swaps source and target when the source is concrete', () => {
    expect(swapLanguagePair({ source: 'en', target: 'pl', fallback: 'de' })).toEqual({
      source: 'pl',
      target: 'en',
      fallback: 'de',
    });
  });

  it('swaps target and fallback when the source is Auto', () => {
    expect(swapLanguagePair({ source: 'auto', target: 'pl', fallback: 'en' })).toEqual({
      source: 'auto',
      target: 'en',
      fallback: 'pl',
    });
  });
});

describe('isSelectionTooLong', () => {
  it('allows exactly the limit and rejects one character more', () => {
    expect(MAX_SELECTION_LENGTH).toBe(4000);
    expect(isSelectionTooLong('a'.repeat(4000))).toBe(false);
    expect(isSelectionTooLong('a'.repeat(4001))).toBe(true);
  });

  it('ignores surrounding whitespace', () => {
    expect(isSelectionTooLong(`  ${'a'.repeat(4000)}\n\n`)).toBe(false);
  });
});
