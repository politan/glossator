import { profileOf, type PromptProfileId } from '../prompts/profiles';
import { privacyOf } from '../providers/privacy';
import { activeProvider, findProvider, providerName, type ProviderSettings } from '../settings';
import { badgeLabel } from './badge';

export interface ProviderChoice {
  id: string;
  label: string;
}

/** Providers that are complete enough to translate with. */
export function providerChoices(settings: ProviderSettings): ProviderChoice[] {
  const ids = [settings.cloud.id, ...settings.locals.map((p) => p.id)];
  return ids.flatMap((id) => {
    const provider = findProvider(settings, id);
    if (!provider) return [];
    const name = providerName(provider);
    const badge = badgeLabel(privacyOf(provider), name);
    const label =
      provider.kind === 'cloud'
        ? `${badge} (${provider.model})`
        : `${name} · ${badge} (${provider.model})`;
    return [{ id, label }];
  });
}

/** The Prompt Profile of the active Provider, which decides the language list. */
export function activeProfile(settings: ProviderSettings): PromptProfileId {
  const provider = activeProvider(settings);
  return provider ? profileOf(provider) : 'generic';
}
