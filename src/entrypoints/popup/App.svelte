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
    type Prefs,
  } from '@/lib/settings';
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

  function selectValue(event: Event): string {
    return (event.currentTarget as HTMLSelectElement).value;
  }

  async function chooseProvider(event: Event) {
    settings = { ...settings, activeProviderId: selectValue(event) };
    await providersItem.setValue($state.snapshot(settings));
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
    <label>
      <span class="field-label">{t('popupFrom')}</span>
      <select value={prefs.source} onchange={(e) => save({ source: selectValue(e) })}>
        <option value="auto">{t('languageAuto')}</option>
        {#each languages as language (language.code)}
          <option value={language.code}>{language.name}</option>
        {/each}
      </select>
    </label>
    <button
      class="swap"
      type="button"
      title={t('popupSwap')}
      aria-label={t('popupSwap')}
      onclick={() => save(swapLanguagePair(prefs))}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 5h9l-2.5-2.5M13 11H4l2.5 2.5" /></svg>
    </button>
    <label>
      <span class="field-label">{t('popupTo')}</span>
      <select value={prefs.target} onchange={(e) => save({ target: selectValue(e) })}>
        {#each languages as language (language.code)}
          <option value={language.code}>{language.name}</option>
        {/each}
      </select>
    </label>
  </div>

  {#if prefs.source === 'auto'}
    <label>
      <span class="field-label">{t('popupFallback')}</span>
      <select value={prefs.fallback} onchange={(e) => save({ fallback: selectValue(e) })}>
        {#each languages as language (language.code)}
          <option value={language.code}>{language.name}</option>
        {/each}
      </select>
    </label>
  {/if}

  <label>
    <span class="field-label">{t('popupProvider')}</span>
    {#if choices.length > 0}
      <select value={settings.activeProviderId} onchange={chooseProvider}>
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
