<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { browser } from 'wxt/browser';
  import { ALL_SITES } from '@/lib/content-script-registration';
  import { t, uiLocale } from '@/lib/i18n';
  import { isSupported, languageName, languagesFor } from '@/lib/languages';
  import { PROMPT_PROFILES } from '@/lib/prompts/profiles';
  import { OPENROUTER_MODELS } from '@/lib/providers/openrouter';
  import { PRESETS } from '@/lib/providers/presets';
  import type { LocalProvider } from '@/lib/providers/types';
  import {
    DEFAULT_PREFS,
    DEFAULT_PROVIDER_SETTINGS,
    loadPrefs,
    providersItem,
    updatePrefs,
    type Prefs,
    type ProviderSettings,
  } from '@/lib/settings';
  import { TranslationError, checkOpenRouterKey } from '@/lib/translation/client';
  import { failureText } from '@/lib/ui/errors';
  import { activeProfile, providerChoices } from '@/lib/ui/providers';
  import LocalServer from './LocalServer.svelte';

  const CUSTOM = '__custom__';

  let prefs = $state<Prefs>(DEFAULT_PREFS);
  let settings = $state<ProviderSettings>(DEFAULT_PROVIDER_SETTINGS);
  let loaded = $state(false);
  let apiKey = $state('');
  let keyStatus = $state<{ ok: boolean; text: string } | null>(null);
  let checkingKey = $state(false);
  let customModel = $state(false);

  const choices = $derived(providerChoices(settings));
  const profile = $derived(activeProfile(settings));
  const languages = $derived(languagesFor(profile, uiLocale()));
  const unsupported = $derived(
    [prefs.target, prefs.fallback].filter((code) => !isSupported(profile, code)),
  );
  const modelSelectValue = $derived(
    customModel || !OPENROUTER_MODELS.some((m) => m.id === settings.cloud.model)
      ? CUSTOM
      : settings.cloud.model,
  );

  onMount(async () => {
    prefs = await loadPrefs();
    settings = await providersItem.getValue();
    apiKey = settings.cloud.apiKey;
    loaded = true;
  });

  async function saveSettings(next: ProviderSettings) {
    // The first working Provider becomes the active one.
    const firstChoice = providerChoices(next)[0];
    if (!next.activeProviderId && firstChoice) next.activeProviderId = firstChoice.id;
    settings = next;
    await providersItem.setValue($state.snapshot(settings));
  }

  async function savePrefs(change: Partial<Prefs>) {
    prefs = await updatePrefs(change);
  }

  function value(event: Event): string {
    return (event.currentTarget as HTMLSelectElement | HTMLInputElement).value;
  }

  async function checkKey() {
    checkingKey = true;
    keyStatus = null;
    try {
      const status = await checkOpenRouterKey(apiKey.trim());
      keyStatus = {
        ok: true,
        text:
          status.limitRemaining === null
            ? t('cloudKeyOkUnlimited')
            : t('cloudKeyOk', `$${status.limitRemaining.toFixed(2)}`),
      };
      await saveSettings({ ...settings, cloud: { ...settings.cloud, apiKey: apiKey.trim() } });
    } catch (error) {
      keyStatus = {
        ok: false,
        text: failureText(error instanceof TranslationError ? error.code : 'unknown'),
      };
    } finally {
      checkingKey = false;
    }
  }

  async function chooseModel(event: Event) {
    const model = value(event);
    customModel = model === CUSTOM;
    if (!customModel) await saveSettings({ ...settings, cloud: { ...settings.cloud, model } });
  }

  async function addServer() {
    const preset = PRESETS[0];
    if (!preset) return;
    const server: LocalProvider = {
      kind: 'local',
      id: crypto.randomUUID(),
      name: preset.label,
      preset: preset.id,
      baseUrl: preset.baseUrl,
      apiKey: '',
      model: '',
      promptProfile: 'auto',
    };
    await saveSettings({ ...settings, locals: [...settings.locals, server] });
  }

  async function saveServer(server: LocalProvider) {
    await saveSettings({
      ...settings,
      locals: settings.locals.map((s) => (s.id === server.id ? server : s)),
    });
  }

  async function removeServer(id: string) {
    await saveSettings({
      ...settings,
      activeProviderId: settings.activeProviderId === id ? null : settings.activeProviderId,
      locals: settings.locals.filter((s) => s.id !== id),
    });
  }

  async function toggleSelectionIcon(event: Event) {
    const enabled = (event.currentTarget as HTMLInputElement).checked;
    if (enabled && !(await browser.permissions.request({ origins: ALL_SITES }))) {
      (event.currentTarget as HTMLInputElement).checked = false;
      return;
    }
    if (!enabled) await browser.permissions.remove({ origins: ALL_SITES });
    await savePrefs({ selectionIcon: enabled });
  }

  async function startWith(kind: 'local' | 'cloud') {
    if (kind === 'local' && settings.locals.length === 0) await addServer();
    await tick();
    document.getElementById(kind)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
</script>

<main>
  <h1>
    <img src="/icon/48.png" alt="" width="32" height="32" />
    {t('settingsTitle')}
  </h1>

  {#if loaded && choices.length === 0}
    <section class="onboarding">
      <h2>{t('onboardingTitle')}</h2>
      <p class="hint">{t('onboardingIntro')}</p>
      <div class="cards">
        <button type="button" class="card" onclick={() => startWith('local')}>
          <strong>{t('onboardingLocalTitle')}</strong>
          <span>{t('onboardingLocalBody')}</span>
          <span class="cta">{t('onboardingChoose')} →</span>
        </button>
        <button type="button" class="card" onclick={() => startWith('cloud')}>
          <strong>{t('onboardingCloudTitle')}</strong>
          <span>{t('onboardingCloudBody')}</span>
          <span class="cta">{t('onboardingChoose')} →</span>
        </button>
      </div>
    </section>
  {/if}

  <section>
    <h2>{t('sectionProvider')}</h2>
    {#if choices.length > 0}
      <select
        value={settings.activeProviderId}
        onchange={(e) => saveSettings({ ...settings, activeProviderId: value(e) })}
      >
        {#each choices as choice (choice.id)}
          <option value={choice.id}>{choice.label}</option>
        {/each}
      </select>
    {:else}
      <p class="hint">{t('providerNone')}</p>
    {/if}
    <p class="hint">{t('sectionProviderHint')}</p>
  </section>

  <section id="local">
    <h2>{t('sectionLocal')}</h2>
    <p class="hint">{t('localHint')}</p>
    {#each settings.locals as server (server.id)}
      <LocalServer {server} onsave={saveServer} onremove={() => removeServer(server.id)} />
    {/each}
    <div>
      <button type="button" onclick={addServer}>+ {t('localAdd')}</button>
    </div>
  </section>

  <section id="cloud">
    <h2>{t('sectionCloud')}</h2>
    <label>
      <span class="field-label">{t('cloudKey')}</span>
      <span class="row">
        <input
          bind:value={apiKey}
          type="password"
          autocomplete="off"
          spellcheck="false"
          placeholder="sk-or-v1-…"
        />
        <button type="button" disabled={checkingKey || !apiKey.trim()} onclick={checkKey}>
          {checkingKey ? t('cloudKeyChecking') : t('cloudKeyCheck')}
        </button>
      </span>
      <span class="hint">{t('cloudKeyHint')}</span>
    </label>
    {#if keyStatus}
      <p class="status" class:error={!keyStatus.ok}>{keyStatus.text}</p>
    {/if}

    <label>
      <span class="field-label">{t('cloudModel')}</span>
      <select value={modelSelectValue} onchange={chooseModel}>
        {#each OPENROUTER_MODELS as model (model.id)}
          <option value={model.id}>{model.id} ({t(model.noteKey)})</option>
        {/each}
        <option value={CUSTOM}>{t('cloudModelCustom')}</option>
      </select>
    </label>
    {#if modelSelectValue === CUSTOM}
      <label>
        <input
          value={OPENROUTER_MODELS.some((m) => m.id === settings.cloud.model)
            ? ''
            : settings.cloud.model}
          placeholder="vendor/model"
          spellcheck="false"
          onchange={(e) =>
            saveSettings({ ...settings, cloud: { ...settings.cloud, model: value(e).trim() } })}
        />
        <span class="hint">{t('cloudModelCustomHint')}</span>
      </label>
    {/if}

    <label>
      <span class="field-label">{t('promptProfile')}</span>
      <select
        value={settings.cloud.promptProfile}
        onchange={(e) =>
          saveSettings({
            ...settings,
            cloud: {
              ...settings.cloud,
              promptProfile: value(e) as typeof settings.cloud.promptProfile,
            },
          })}
      >
        <option value="auto">{t('promptProfileAuto')}</option>
        {#each PROMPT_PROFILES as option (option)}
          <option value={option}>{option}</option>
        {/each}
      </select>
    </label>

    <label class="check">
      <input
        type="checkbox"
        checked={settings.cloud.strictPrivacy}
        onchange={(e) =>
          saveSettings({
            ...settings,
            cloud: { ...settings.cloud, strictPrivacy: e.currentTarget.checked },
          })}
      />
      <span>
        {t('cloudStrictPrivacy')}
        <span class="hint">{t('cloudStrictPrivacyHint')}</span>
      </span>
    </label>
  </section>

  <section>
    <h2>{t('sectionLanguages')}</h2>
    <div class="languages">
      <label>
        <span class="field-label">{t('languagesSource')}</span>
        <select value={prefs.source} onchange={(e) => savePrefs({ source: value(e) })}>
          <option value="auto">{t('languageAuto')}</option>
          {#each languages as language (language.code)}
            <option value={language.code}>{language.name}</option>
          {/each}
        </select>
      </label>
      <label>
        <span class="field-label">{t('languagesTarget')}</span>
        <select value={prefs.target} onchange={(e) => savePrefs({ target: value(e) })}>
          {#each languages as language (language.code)}
            <option value={language.code}>{language.name}</option>
          {/each}
        </select>
      </label>
      {#if prefs.source === 'auto'}
        <label>
          <span class="field-label">{t('languagesFallback')}</span>
          <select value={prefs.fallback} onchange={(e) => savePrefs({ fallback: value(e) })}>
            {#each languages as language (language.code)}
              <option value={language.code}>{language.name}</option>
            {/each}
          </select>
        </label>
      {/if}
    </div>
    {#each unsupported as code (code)}
      <p class="status error">{t('languagesUnsupported', languageName(code, uiLocale()))}</p>
    {/each}
    <label class="check">
      <input
        type="checkbox"
        checked={prefs.useSurroundingContext}
        onchange={(e) => savePrefs({ useSurroundingContext: e.currentTarget.checked })}
      />
      <span>
        {t('surroundingContext')}
        <span class="hint">{t('surroundingContextHint')}</span>
      </span>
    </label>
  </section>

  <section>
    <h2>{t('sectionSelectionIcon')}</h2>
    <label class="check">
      <input type="checkbox" checked={prefs.selectionIcon} onchange={toggleSelectionIcon} />
      <span>
        {t('selectionIconToggle')}
        <span class="hint">{t('selectionIconHint')}</span>
      </span>
    </label>
  </section>

  <section>
    <h2>{t('sectionShortcut')}</h2>
    <p class="hint">{t('shortcutHint')}</p>
    <div>
      <button
        type="button"
        onclick={() => browser.tabs.create({ url: 'chrome://extensions/shortcuts' })}
      >
        {t('shortcutOpen')}
      </button>
    </div>
  </section>
</main>

<style>
  main {
    display: grid;
    gap: 28px;
    max-width: 720px;
    margin: 0 auto;
    padding: 32px 16px 64px;
  }

  h1 {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 0;
    font-size: 22px;
  }

  h2 {
    margin: 0;
    font-size: 16px;
  }

  section {
    display: grid;
    gap: 12px;
  }

  .onboarding {
    padding: 20px;
    border: 1px solid var(--g-border);
    border-radius: var(--g-radius);
    background: var(--g-bg-subtle);
  }

  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 12px;
  }

  .card {
    display: grid;
    gap: 8px;
    align-content: start;
    padding: 16px;
    text-align: left;
    line-height: 1.45;
    border-radius: var(--g-radius);
  }

  .card:first-child {
    border-color: var(--g-local);
  }

  .cta {
    color: var(--g-accent);
    font-weight: 600;
  }

  .row {
    display: flex;
    gap: 8px;
  }

  .row input {
    flex: 1;
  }

  .languages {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
  }

  .check .hint {
    display: block;
    margin-top: 2px;
  }

  .status {
    margin: 0;
    font-size: 13px;
    color: var(--g-local);
  }

  .status.error {
    color: var(--g-danger);
  }
</style>
