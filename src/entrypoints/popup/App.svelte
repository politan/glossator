<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from 'wxt/browser';
  import { t, uiLocale } from '@/lib/i18n';
  import { languagesFor } from '@/lib/languages';
  import { swapLanguagePair } from '@/lib/pair';
  import {
    DEFAULT_PREFS,
    DEFAULT_PROVIDER_SETTINGS,
    loadPrefs,
    providersItem,
    updatePrefs,
    updateProviderSettings,
    type Prefs,
  } from '@/lib/settings';
  import LanguageSelect from '@/lib/ui/LanguageSelect.svelte';
  import { activeProfile, providerChoices } from '@/lib/ui/providers';

  let prefs = $state<Prefs>(DEFAULT_PREFS);
  let settings = $state(DEFAULT_PROVIDER_SETTINGS);
  let site = $state<string | null>(null);

  const languages = $derived(languagesFor(activeProfile(settings), uiLocale()));
  const choices = $derived(providerChoices(settings));
  const hiddenHere = $derived(site !== null && prefs.disabledSites.includes(site));

  onMount(async () => {
    prefs = await loadPrefs();
    settings = await providersItem.getValue();
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.url?.startsWith('http')) site = new URL(tab.url).hostname;
  });

  async function save(change: Partial<Prefs>) {
    prefs = await updatePrefs(change);
  }

  async function chooseProvider(id: string) {
    settings = await updateProviderSettings((current) => ({ ...current, activeProviderId: id }));
  }

  async function toggleSite() {
    if (!site) return;
    const disabledSites = hiddenHere
      ? prefs.disabledSites.filter((s) => s !== site)
      : [...prefs.disabledSites, site];
    await save({ disabledSites });
  }
</script>

<main>
  <div class="pair">
    <LanguageSelect
      label={t('popupFrom')}
      value={prefs.source}
      {languages}
      autoLabel={t('languageAuto')}
      onchange={(source: string) => save({ source })}
    />
    <button
      class="swap"
      type="button"
      title={t('popupSwap')}
      aria-label={t('popupSwap')}
      onclick={() => save(swapLanguagePair(prefs))}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 5h9l-2.5-2.5M13 11H4l2.5 2.5" /></svg>
    </button>
    <LanguageSelect
      label={t('popupTo')}
      value={prefs.target}
      {languages}
      onchange={(target: string) => save({ target })}
    />
  </div>

  {#if prefs.source === 'auto'}
    <LanguageSelect
      label={t('popupFallback')}
      value={prefs.fallback}
      {languages}
      onchange={(fallback: string) => save({ fallback })}
    />
  {/if}

  <label>
    <span class="field-label">{t('popupProvider')}</span>
    {#if choices.length > 0}
      <select
        value={settings.activeProviderId}
        onchange={(e) => chooseProvider(e.currentTarget.value)}
      >
        {#each choices as choice (choice.id)}
          <option value={choice.id}>{choice.label}</option>
        {/each}
      </select>
    {:else}
      <span class="hint">{t('popupNothingConfigured')}</span>
    {/if}
  </label>

  {#if prefs.selectionIcon && site}
    <label class="check">
      <input type="checkbox" checked={hiddenHere} onchange={toggleSite} />
      <span>{t('popupHideOnSite', site)}</span>
    </label>
  {/if}

  <footer>
    <button type="button" onclick={() => browser.runtime.openOptionsPage()}>
      {t('popupSettings')}
    </button>
  </footer>
</main>

<style>
  main {
    display: grid;
    gap: 12px;
    width: 320px;
    padding: 14px;
  }

  .pair {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: end;
    gap: 6px;
  }

  .swap {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    padding: 0;
  }

  .swap svg {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  footer {
    display: flex;
    justify-content: flex-end;
  }
</style>
