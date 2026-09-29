import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import {
  TRANSLATE_PORT,
  isMessage,
  type BackgroundMessage,
  type ShowBubbleMessage,
  type TranslateRequest,
} from '@/lib/messages';
import { syncOriginRules } from '@/lib/providers/origin-sync';
import { providersItem, type ProviderSettings } from '@/lib/settings';
import { runTranslation } from '@/lib/translate-session';

const MENU_ID = 'glossa-translate-selection';
const CONTENT_SCRIPT_FILE = '/content-scripts/content.js';
const TOP_FRAME = 0;

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
    void showBubble(tab.id, info.frameId ?? TOP_FRAME, info.selectionText);
  });

  browser.commands.onCommand.addListener((command, tab) => {
    if (command !== 'translate-selection' || !tab?.id) return;
    const tabId = tab.id;
    void frameWithSelection(tabId).then((frameId) => showBubble(tabId, frameId));
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
  void providersItem.getValue().then(syncSavedOriginRules);
});

/**
 * The shortcut does not say where the selection is, and it may sit in an
 * iframe. Asks every frame and falls back to the top one, which then tells the
 * user to select something.
 */
async function frameWithSelection(tabId: number): Promise<number> {
  try {
    const results = await browser.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => {
        const field = document.activeElement;
        if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
          return (field.selectionEnd ?? 0) > (field.selectionStart ?? 0);
        }
        return Boolean(window.getSelection()?.toString().trim());
      },
    });
    return results.find((r) => r.result === true)?.frameId ?? TOP_FRAME;
  } catch {
    return TOP_FRAME;
  }
}

/** Opens the Bubble in a frame, injecting the content script first when it is not there yet. */
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
