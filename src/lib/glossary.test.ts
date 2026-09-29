import { describe, expect, it } from 'vitest';
import { termsFor, type TermPair } from './glossary';

const glossary: TermPair[] = [
  { id: '1', langA: 'en', termA: 'deployment', langB: 'pl', termB: 'wdrożenie' },
  { id: '2', langA: 'en', termA: 'lead', langB: 'pl', termB: 'lead' },
  { id: '3', langA: 'en', termA: 'pull request', langB: 'pl', termB: 'pull request' },
  { id: '4', langA: 'de', termA: 'Bereitstellung', langB: 'pl', termB: 'wdrożenie' },
];

describe('termsFor', () => {
  it('picks only the Term Pairs whose term appears in the Selection', () => {
    expect(
      termsFor(glossary, 'The lead asked for a pull request.', { source: 'en', target: 'pl' }),
    ).toEqual([
      { source: 'lead', target: 'lead' },
      { source: 'pull request', target: 'pull request' },
    ]);
  });

  it('works in the other direction too', () => {
    expect(termsFor(glossary, 'Wdrożenie jutro', { source: 'pl', target: 'en' })).toEqual([
      { source: 'wdrożenie', target: 'deployment' },
    ]);
  });

  it('ignores case', () => {
    expect(termsFor(glossary, 'DEPLOYMENT failed', { source: 'en', target: 'pl' })).toEqual([
      { source: 'deployment', target: 'wdrożenie' },
    ]);
  });

  it('matches inflected forms that start with the term', () => {
    expect(termsFor(glossary, 'Po wdrożeniem', { source: 'pl', target: 'en' })).toEqual([
      { source: 'wdrożenie', target: 'deployment' },
    ]);
  });

  it('does not match a term hidden inside another word', () => {
    expect(termsFor(glossary, 'A misleading headline', { source: 'en', target: 'pl' })).toEqual([]);
  });

  it('skips pairs for other languages', () => {
    expect(termsFor(glossary, 'deployment', { source: 'en', target: 'de' })).toEqual([]);
  });

  it('trusts the target when the source language is unknown', () => {
    expect(termsFor(glossary, 'deployment', { source: null, target: 'pl' })).toEqual([
      { source: 'deployment', target: 'wdrożenie' },
    ]);
  });
});
