import { browser, type Browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import {
  CONTENT_SCRIPT_FILE,
  syncSelectionIconRegistration,
} from '@/lib/content-script-registration';
import {
  TRANSLATE_PORT,
  isMessage,
  type BackgroundMessage,
  type ShowBubbleMessage,
  type TranslateRequest,
} from '@/lib/messages';
import { originRules } from '@/lib/providers/origin-rule';
import {
  loadPrefs,
  prefsItem,
  providersItem,
  updatePrefs,
  type ProviderSettings,
} from '@/lib/settings';
import { runTranslation } from '@/lib/translate-session';

const MENU_ID = 'glossa-translate-selection';

export default defineBackground(() => {
  // API Keys live in storage.local; keep that area out of content scripts' reach (ADR 0001).
  void browser.storage.local
    .setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })
    .catch(() => undefined);

  browser.runtime.onInstalled.addListener(({ reason }) => {
    browser.contextMenus.create({
      id: MENU_ID,
      title: browser.i18n.getMessage('contextMenuTranslate'),
      contexts: ['selection'],
    });
    if (reason === 'install') void browser.runtime.openOptionsPage();
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== MENU_ID || !tab?.id) return;
    void showBubble(tab.id, info.frameId ?? 0, info.selectionText);
  });

  browser.commands.onCommand.addListener((command, tab) => {
    if (command !== 'translate-selection' || !tab?.id) return;
    void showBubble(tab.id, 0);
  });

  browser.runtime.onMessage.addListener((message: unknown) => {
    if (isMessage<BackgroundMessage>(message, 'glossa:open-settings')) {
      void browser.runtime.openOptionsPage();
    }
  });

  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== TRANSLATE_PORT) return;
    let controller: AbortController | null = null;
    port.onDisconnect.addListener(() => controller?.abort());
    port.onMessage.addListener((request: TranslateRequest) => {
      controller?.abort();
      const current = new AbortController();
      controller = current;
      void runTranslation(
        request,
        (event) => {
          if (!current.signal.aborted) port.postMessage(event);
        },
        current.signal,
      );
    });
  });

  providersItem.watch((settings) => void syncOriginRules(settings));
  prefsItem.watch((prefs) => void syncSelectionIconRegistration(prefs.selectionIcon));
  browser.permissions.onRemoved.addListener(() => {
    void loadPrefs().then(async (prefs) => {
      await syncSelectionIconRegistration(prefs.selectionIcon);
      if (
        prefs.selectionIcon &&
        !(await browser.permissions.contains({ origins: ['https://*/*'] }))
      ) {
        await updatePrefs({ selectionIcon: false });
      }
    });
  });

  void providersItem.getValue().then(syncOriginRules);
  void loadPrefs().then((prefs) => syncSelectionIconRegistration(prefs.selectionIcon));
});

/** Opens the Bubble in a tab, injecting the content script first when it is not there yet. */
async function showBubble(tabId: number, frameId: number, selectionText?: string): Promise<void> {
  const message: ShowBubbleMessage = { type: 'glossa:show-bubble', selectionText };
  try {
    await browser.tabs.sendMessage(tabId, message, { frameId });
  } catch {
    await browser.scripting.executeScript({
      target: { tabId, frameIds: [frameId] },
      files: [CONTENT_SCRIPT_FILE],
    });
    await browser.tabs.sendMessage(tabId, message, { frameId });
  }
}

async function syncOriginRules(settings: ProviderSettings): Promise<void> {
  const rules = originRules(
    settings.locals.map((p) => p.baseUrl),
    browser.runtime.id,
  ) as unknown as Browser.declarativeNetRequest.Rule[];
  const existing = await browser.declarativeNetRequest.getDynamicRules();
  await browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((rule) => rule.id),
    addRules: rules,
  });
}
