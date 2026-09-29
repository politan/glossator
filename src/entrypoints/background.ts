import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import {
  CONTENT_SCRIPT_FILE,
  hasAllSitesAccess,
  syncSelectionIconRegistration,
} from '@/lib/content-script-registration';
import {
  TRANSLATE_PORT,
  isMessage,
  type BackgroundMessage,
  type ShowBubbleMessage,
  type TranslateRequest,
} from '@/lib/messages';
import { syncOriginRules } from '@/lib/providers/origin-sync';
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

  const syncSavedOriginRules = (settings: ProviderSettings) =>
    syncOriginRules(settings.locals.map((p) => p.baseUrl));
  providersItem.watch((settings) => void syncSavedOriginRules(settings));
  prefsItem.watch((prefs) => void syncSelectionIconRegistration(prefs.selectionIcon));
  browser.permissions.onRemoved.addListener(() => {
    void loadPrefs().then(async (prefs) => {
      await syncSelectionIconRegistration(prefs.selectionIcon);
      if (prefs.selectionIcon && !(await hasAllSitesAccess())) {
        await updatePrefs({ selectionIcon: false });
      }
    });
  });

  void providersItem.getValue().then(syncSavedOriginRules);
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
