import { browser, type Browser } from 'wxt/browser';
import { originRules } from './origin-rule';

/** Replaces Glossator's dynamic rules with Origin rewrites for the given Local Provider addresses. */
export async function syncOriginRules(baseUrls: readonly string[]): Promise<void> {
  // Glossator's own rule shape matches the API's; the API types use enums for the literals.
  const rules = originRules(
    baseUrls,
    browser.runtime.id,
  ) as unknown as Browser.declarativeNetRequest.Rule[];
  const existing = await browser.declarativeNetRequest.getDynamicRules();
  await browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((rule) => rule.id),
    addRules: rules,
  });
}
