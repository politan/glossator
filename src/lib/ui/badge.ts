import { t } from '../i18n';
import type { Privacy } from '../providers/privacy';

export function badgeLabel(privacy: Privacy, providerName: string): string {
  switch (privacy) {
    case 'local':
      return t('badgeLocal');
    case 'self-hosted':
      return t('badgeSelfHosted');
    case 'cloud':
      return `${t('badgeCloud')} · ${providerName}`;
  }
}
