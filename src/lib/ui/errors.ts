import { t } from '../i18n';
import type { TranslateFailure } from '../messages';
import { MAX_SELECTION_LENGTH } from '../pair';

export function failureText(code: TranslateFailure): string {
  switch (code) {
    case 'not-configured':
      return t('errorNotConfigured');
    case 'empty':
      return t('errorEmpty');
    case 'too-long':
      return t('errorTooLong', String(MAX_SELECTION_LENGTH));
    case 'unauthorized':
      return t('errorUnauthorized');
    case 'insufficient-credits':
      return t('errorInsufficientCredits');
    case 'moderation':
      return t('errorModeration');
    case 'origin-rejected':
      return t('errorOriginRejected');
    case 'model-not-found':
      return t('errorModelNotFound');
    case 'timeout':
      return t('errorTimeout');
    case 'rate-limited':
      return t('errorRateLimited');
    case 'unavailable':
      return t('errorUnavailable');
    case 'bad-request':
      return t('errorBadRequest');
    case 'unreachable':
      return t('errorUnreachable');
    case 'unknown':
      return t('errorUnknown');
  }
}

/** Failures the user fixes in Settings. */
export function needsSettings(code: TranslateFailure): boolean {
  return ['not-configured', 'unauthorized', 'model-not-found', 'insufficient-credits'].includes(
    code,
  );
}

/** Whether the server's own message adds anything to our text. */
export function showsDetail(code: TranslateFailure): boolean {
  return ['bad-request', 'moderation', 'model-not-found', 'unavailable', 'unknown'].includes(code);
}
