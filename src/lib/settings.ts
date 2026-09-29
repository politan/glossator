import { storage } from 'wxt/utils/storage';
import type { LanguagePrefs } from './pair';
import type { StyleId } from './style';
import { DEFAULT_OPENROUTER_MODEL } from './providers/openrouter';
import type { CloudProvider, LocalProvider, Provider } from './providers/types';

/** Preferences without secrets; synced across the user's browsers. */
export interface Prefs extends LanguagePrefs {
  useSurroundingContext: boolean;
  selectionIcon: boolean;
  /** Hostnames where the Selection Icon stays hidden. */
  disabledSites: string[];
  style: StyleId;
  /** The user's own Style description, used when `style` is `custom`. */
  customStyle: string;
}

export const DEFAULT_PREFS: Prefs = {
  source: 'auto',
  target: 'pl',
  fallback: 'en',
  useSurroundingContext: false,
  selectionIcon: true,
  disabledSites: [],
  style: 'auto',
  customStyle: '',
};

/** Providers hold API Keys, so they stay on this device (ADR 0001). */
export interface ProviderSettings {
  activeProviderId: string | null;
  cloud: CloudProvider;
  locals: LocalProvider[];
}

export const DEFAULT_PROVIDER_SETTINGS: ProviderSettings = {
  activeProviderId: null,
  cloud: {
    kind: 'cloud',
    id: 'openrouter',
    apiKey: '',
    model: DEFAULT_OPENROUTER_MODEL,
    promptProfile: 'auto',
    strictPrivacy: true,
  },
  locals: [],
};

export const prefsItem = storage.defineItem<Prefs>('sync:prefs', {
  fallback: DEFAULT_PREFS,
  version: 2,
  migrations: {
    // The Selection Icon became on by default (ADR 0005).
    2: (prefs: Prefs): Prefs => ({ ...prefs, selectionIcon: true }),
  },
});

export const providersItem = storage.defineItem<ProviderSettings>('local:providers', {
  fallback: DEFAULT_PROVIDER_SETTINGS,
});

export async function loadPrefs(): Promise<Prefs> {
  return { ...DEFAULT_PREFS, ...(await prefsItem.getValue()) };
}

export async function updatePrefs(change: Partial<Prefs>): Promise<Prefs> {
  const next = { ...(await loadPrefs()), ...change };
  await prefsItem.setValue(next);
  return next;
}

/** Read-modify-write, so pages open side by side do not overwrite each other's changes. */
export async function updateProviderSettings(
  change: (current: ProviderSettings) => ProviderSettings,
): Promise<ProviderSettings> {
  const next = change(await providersItem.getValue());
  await providersItem.setValue(next);
  return next;
}

export function findProvider(settings: ProviderSettings, id: string | null): Provider | null {
  if (id === settings.cloud.id) return settings.cloud.apiKey ? settings.cloud : null;
  return settings.locals.find((p) => p.id === id && p.model) ?? null;
}

export function activeProvider(settings: ProviderSettings): Provider | null {
  return findProvider(settings, settings.activeProviderId);
}

export function providerName(provider: Provider): string {
  return provider.kind === 'cloud' ? 'OpenRouter' : provider.name;
}
