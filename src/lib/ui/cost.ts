import type { Usage } from '../translation/client';
import { t } from '../i18n';

/** A Translation costs fractions of a cent, so keep the significant digits. */
export function formatCost(usage: Usage, uiLocale: string): string {
  return new Intl.NumberFormat(uiLocale, {
    style: 'currency',
    currency: 'USD',
    maximumSignificantDigits: 2,
  }).format(usage.costUsd);
}

export function tokenSummary(usage: Usage): string {
  return t('costTokens', [String(usage.promptTokens), String(usage.completionTokens)]);
}
