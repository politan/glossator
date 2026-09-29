import type { LanguageCode } from './languages';
import type { LanguagePair } from './pair';

export interface TermPair {
  id: string;
  langA: LanguageCode;
  termA: string;
  langB: LanguageCode;
  termB: string;
}

/** A Term Pair oriented for one Translation. */
export interface Term {
  source: string;
  target: string;
}

/**
 * The Term Pairs that apply to a Selection, oriented towards the Target
 * Language. Only terms that occur in the Selection are sent to the model.
 */
export function termsFor(glossary: readonly TermPair[], text: string, pair: LanguagePair): Term[] {
  return glossary.flatMap((entry) => {
    const term = orient(entry, pair);
    return term && occursIn(term.source, text) ? [term] : [];
  });
}

function orient(entry: TermPair, { source, target }: LanguagePair): Term | null {
  if (target === entry.langB && (source === null || source === entry.langA)) {
    return { source: entry.termA, target: entry.termB };
  }
  if (target === entry.langA && (source === null || source === entry.langB)) {
    return { source: entry.termB, target: entry.termA };
  }
  return null;
}

/**
 * Case-insensitive, starting at a word boundary but open at the end, so that
 * inflected forms (wdrożenie → wdrożeniem) still count.
 */
function occursIn(term: string, text: string): boolean {
  const trimmed = term.trim();
  if (!trimmed) return false;
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}`, 'iu').test(text);
}
