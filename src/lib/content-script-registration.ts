import { browser } from 'wxt/browser';
import { ALL_SITES } from './all-sites';

const SCRIPT_ID = 'glossa-selection-icon';
export const CONTENT_SCRIPT_FILE = '/content-scripts/content.js';

export function hasAllSitesAccess(): Promise<boolean> {
  return browser.permissions.contains({ origins: ALL_SITES });
}

/**
 * Keeps the content script registered on every page exactly while the user has
 * the Selection Icon on and has granted access to all sites (ADR 0004).
 */
export async function syncSelectionIconRegistration(enabled: boolean): Promise<void> {
  const shouldRun = enabled && (await hasAllSitesAccess());
  const existing = await browser.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });
  if (shouldRun && existing.length === 0) {
    await browser.scripting.registerContentScripts([
      {
        id: SCRIPT_ID,
        js: [CONTENT_SCRIPT_FILE.slice(1)],
        matches: ALL_SITES,
        runAt: 'document_idle',
        allFrames: false,
      },
    ]);
  } else if (!shouldRun && existing.length > 0) {
    await browser.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
  }
}
