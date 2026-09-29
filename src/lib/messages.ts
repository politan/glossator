import type { PromptProfileId } from './prompts/profile-id';
import type { LanguagePair } from './pair';
import type { Privacy } from './providers/privacy';
import type { TranslationErrorCode } from './translation/client';

export const TRANSLATE_PORT = 'glossator:translate';

/** Sent by the Bubble over the translate port. */
export interface TranslateRequest {
  type: 'translate';
  text: string;
  /** Surrounding Context, only when the user opted in. */
  context: string | null;
  /** One-off Target Language chosen in the Bubble. */
  target: string | null;
  /** One-off retry on the Cloud Provider after a Local Provider failed (ADR 0002). */
  viaCloud: boolean;
}

export type TranslateFailure = TranslationErrorCode | 'not-configured' | 'too-long' | 'empty';

export type TranslateEvent =
  | {
      type: 'meta';
      privacy: Privacy;
      providerName: string;
      model: string;
      profile: PromptProfileId;
      pair: LanguagePair;
    }
  | { type: 'delta'; text: string }
  | { type: 'done' }
  | { type: 'error'; code: TranslateFailure; detail?: string; cloudAvailable: boolean };

/** Messages the background sends to a tab's content script. */
export interface ShowBubbleMessage {
  type: 'glossator:show-bubble';
  /** Selection reported by the browser, used when the page's own selection is unavailable. */
  selectionText?: string;
}

/** Messages extension pages and content scripts send to the background. */
export interface BackgroundMessage {
  type: 'glossator:open-settings';
}

/** Runtime messages arrive untyped; check the discriminator before trusting one. */
export function isMessage<T extends { type: string }>(value: unknown, type: T['type']): value is T {
  return typeof value === 'object' && value !== null && (value as { type?: unknown }).type === type;
}
