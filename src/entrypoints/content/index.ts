import { mount, unmount } from 'svelte';
import { browser } from 'wxt/browser';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import {
  createShadowRootUi,
  type ShadowRootContentScriptUi,
} from 'wxt/utils/content-script-ui/shadow-root';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { isMessage, type ShowBubbleMessage } from '@/lib/messages';
import { isSelectionEditable, snapshotSelection, type SelectionSnapshot } from '@/lib/selection';
import { DEFAULT_PREFS, prefsItem, type Prefs } from '@/lib/settings';
import tokens from '@/lib/ui/tokens.css?inline';
import Bubble from './Bubble.svelte';
import SelectionIcon from './SelectionIcon.svelte';

type Ui = ShadowRootContentScriptUi<ReturnType<typeof mount>>;

const MIN_ICON_SELECTION = 2;
const GAP = 8;
const ICON_OFFSET = 2;
const BUBBLE_WIDTH = 420;

export default defineContentScript({
  // Never in the manifest: injected on demand through activeTab, or registered
  // on all sites once the user turns on the Selection Icon (ADR 0004).
  matches: ['<all_urls>'],
  registration: 'runtime',
  cssInjectionMode: 'manual',

  main(ctx) {
    // The script can be injected again on demand; keep a single instance per page.
    const page = window as { __glossaLoaded?: boolean };
    if (page.__glossaLoaded) return;
    page.__glossaLoaded = true;

    let prefs: Prefs = DEFAULT_PREFS;
    void prefsItem.getValue().then((value) => (prefs = value));
    const unwatch = prefsItem.watch((value) => (prefs = value));
    ctx.onInvalidated(unwatch);

    let bubble: Ui | null = null;
    let icon: Ui | null = null;

    const closeBubble = () => {
      bubble?.remove();
      bubble = null;
    };
    const hideIcon = () => {
      icon?.remove();
      icon = null;
    };

    const openBubble = async (snapshot: SelectionSnapshot) => {
      hideIcon();
      closeBubble();
      const context = prefs.useSurroundingContext ? snapshot.context : null;
      const ui = await overlay(ctx, 'glossa-bubble', (target) =>
        mount(Bubble, { target, props: { text: snapshot.text, context, onclose: closeBubble } }),
      );
      bubble = ui;
      // Key events do not leave the shadow root (isolateEvents), so listen inside it too.
      ui.uiContainer.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeBubble();
      });
      place(ui.uiContainer, snapshot.rect, 'below');
    };

    const showIcon = async (snapshot: SelectionSnapshot) => {
      hideIcon();
      const ui = await overlay(ctx, 'glossa-selection-icon', (target) =>
        mount(SelectionIcon, { target, props: { onactivate: () => void openBubble(snapshot) } }),
      );
      icon = ui;
      place(ui.uiContainer, snapshot.rect, 'after');
    };

    browser.runtime.onMessage.addListener((message: unknown) => {
      if (!isMessage<ShowBubbleMessage>(message, 'glossa:show-bubble')) return;
      const snapshot = snapshotSelection() ?? fallbackSnapshot(message.selectionText);
      if (snapshot) void openBubble(snapshot);
    });

    const isOurs = (event: Event) =>
      event.composedPath().some((node) => node === bubble?.shadowHost || node === icon?.shadowHost);

    ctx.addEventListener(document, 'mousedown', (event) => {
      if (isOurs(event)) return;
      hideIcon();
      closeBubble();
    });

    ctx.addEventListener(document, 'keydown', (event) => {
      if (event.key === 'Escape') closeBubble();
      hideIcon();
    });

    ctx.addEventListener(document, 'mouseup', (event) => {
      if (isOurs(event) || !iconAllowed(prefs)) return;
      // Let the browser settle the selection first.
      ctx.setTimeout(() => {
        const snapshot = snapshotSelection();
        if (snapshot && snapshot.text.length >= MIN_ICON_SELECTION && !isSelectionEditable()) {
          void showIcon(snapshot);
        }
      }, 0);
    });
  },
});

function iconAllowed(prefs: Prefs): boolean {
  return prefs.selectionIcon && !prefs.disabledSites.includes(location.hostname);
}

function fallbackSnapshot(text: string | undefined): SelectionSnapshot | null {
  if (!text?.trim()) return null;
  const rect = new DOMRect((window.innerWidth - BUBBLE_WIDTH) / 2, 80, 0, 0);
  return { text: text.trim(), rect, context: null };
}

async function overlay(
  ctx: ContentScriptContext,
  name: string,
  render: (target: HTMLElement) => ReturnType<typeof mount>,
): Promise<Ui> {
  const ui = await createShadowRootUi(ctx, {
    name,
    position: 'inline',
    anchor: 'html',
    append: 'last',
    css: tokens,
    isolateEvents: true,
    onMount: (container) => {
      container.classList.add('glossa-theme');
      return render(container);
    },
    onRemove: (app) => {
      if (app) void unmount(app);
    },
  });
  ui.mount();
  return ui;
}

/**
 * Positions an overlay next to the selection, in page coordinates so it scrolls
 * with it. The container inside the shadow root is moved rather than the host,
 * because WXT resets the host with `all: initial !important`, which beats any
 * inline style on it.
 */
function place(container: HTMLElement, rect: DOMRect, where: 'below' | 'after'): void {
  Object.assign(container.style, {
    position: 'absolute',
    zIndex: '2147483647',
    top: '0px',
    left: '0px',
  });
  const { width, height } = container.getBoundingClientRect();
  let top = where === 'below' ? rect.bottom + GAP : rect.bottom + ICON_OFFSET;
  let left = where === 'below' ? rect.left : rect.right + ICON_OFFSET;
  if (where === 'below' && top + height > window.innerHeight && rect.top - GAP - height > 0) {
    top = rect.top - GAP - height;
  }
  left = Math.min(Math.max(GAP, left), window.innerWidth - width - GAP);
  container.style.top = `${top + window.scrollY}px`;
  container.style.left = `${left + window.scrollX}px`;
}
