export interface SelectionSnapshot {
  text: string;
  /** Viewport rectangle of the selection, or of the field holding it. */
  rect: DOMRect;
  /** The block of text around the selection, for Surrounding Context. */
  context: string | null;
}

const CONTEXT_LIMIT = 1500;
const BLOCK_SELECTOR = 'p, li, td, th, dd, blockquote, figcaption, h1, h2, h3, h4, h5, h6, pre';

/** Captures what the user has selected on the page, including inside text fields. */
export function snapshotSelection(): SelectionSnapshot | null {
  const field = focusedTextField();
  if (field) {
    const text = field.value.slice(field.selectionStart ?? 0, field.selectionEnd ?? 0).trim();
    return text ? { text, rect: field.getBoundingClientRect(), context: null } : null;
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const text = selection.toString().trim();
  if (!text) return null;
  const range = selection.getRangeAt(0);
  return { text, rect: range.getBoundingClientRect(), context: surroundingText(range, text) };
}

/** True when the selection sits in something the user is typing into. */
export function isSelectionEditable(): boolean {
  if (focusedTextField()) return true;
  const node = window.getSelection()?.anchorNode;
  const element = node instanceof Element ? node : node?.parentElement;
  return Boolean(element?.closest('[contenteditable=""], [contenteditable="true"]'));
}

function focusedTextField(): HTMLInputElement | HTMLTextAreaElement | null {
  const active = document.activeElement;
  if (active instanceof HTMLTextAreaElement) return active;
  if (active instanceof HTMLInputElement && ['text', 'search', 'url', ''].includes(active.type)) {
    return active;
  }
  return null;
}

function surroundingText(range: Range, selected: string): string | null {
  const container = range.commonAncestorContainer;
  const element = container instanceof Element ? container : container.parentElement;
  const block = element?.closest(BLOCK_SELECTOR) ?? element;
  const text = (block instanceof HTMLElement ? block.innerText : block?.textContent)?.trim();
  if (!text || text === selected) return null;
  if (text.length <= CONTEXT_LIMIT) return text;
  const at = Math.max(0, text.indexOf(selected));
  const start = Math.max(0, at - (CONTEXT_LIMIT - selected.length) / 2);
  return text.slice(start, start + CONTEXT_LIMIT);
}
