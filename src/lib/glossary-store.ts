import { browser } from 'wxt/browser';
import type { TermPair } from './glossary';

// One sync item per Term Pair: storage.sync caps a single item at 8 KB but
// allows 512 items, which leaves room for prefs next to the Glossary.
const PREFIX = 'term:';
export const GLOSSARY_LIMIT = 400;

export async function loadGlossary(): Promise<TermPair[]> {
  const all = await browser.storage.sync.get(null);
  return Object.entries(all)
    .filter(([key]) => key.startsWith(PREFIX))
    .map(([, value]) => value as TermPair)
    .sort((a, b) => a.termA.localeCompare(b.termA));
}

export async function saveTermPair(entry: TermPair): Promise<void> {
  await browser.storage.sync.set({ [PREFIX + entry.id]: entry });
}

export async function removeTermPair(id: string): Promise<void> {
  await browser.storage.sync.remove(PREFIX + id);
}
