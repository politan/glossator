<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { browser } from 'wxt/browser';
  import { t, uiLocale } from '@/lib/i18n';
  import { isSupported, languageName, languagesFor } from '@/lib/languages';
  import { PROMPT_PROFILES } from '@/lib/prompts/profiles';
  import { OPENROUTER_MODELS } from '@/lib/providers/openrouter';
  import { PRESETS } from '@/lib/providers/presets';
  import type { CloudProvider, LocalProvider } from '@/lib/providers/types';
  import {
    DEFAULT_PREFS,
    DEFAULT_PROVIDER_SETTINGS,
    loadPrefs,
    prefsItem,
    providersItem,
    updatePrefs,
    updateProviderSettings,
    type Prefs,
    type ProviderSettings,
  } from '@/lib/settings';
  import { TranslationError, checkOpenRouterKey } from '@/lib/translation/client';
  import LanguageSelect from '@/lib/ui/LanguageSelect.svelte';
  import { failureText } from '@/lib/ui/errors';
  import { activeProfile, providerChoices } from '@/lib/ui/providers';
  import type { StyleId } from '@/lib/style';
  import StyleSelect from '@/lib/ui/StyleSelect.svelte';
  import GlossarySection from './GlossarySection.svelte';
  import LocalProviderCard from './LocalProviderCard.svelte';

  const CUSTOM_MODEL = '__custom__';

  let prefs = $state<Prefs>(DEFAULT_PREFS);
  let settings = $state<ProviderSettings>(DEFAULT_PROVIDER_SETTINGS);
  let loaded = $state(false);
  let apiKey = $state('');
  let keyStatus = $state<{ ok: boolean; text: string } | null>(null);
  let checkingKey = $state(false);
  let customModelChosen = $state(false);
  /** Empty when the browser left the shortcut unassigned, e.g. after a conflict. */
  let shortcut = $state<string | null>(null);

  const choices = $derived(providerChoices(settings));
  const profile = $derived(activeProfile(settings));
  const languages = $derived(languagesFor(profile, uiLocale()));
  const unsupported = $derived(
    [prefs.target, prefs.fallback].filter((code) => !isSupported(profile, code)),
  );
  const curatedModel = $derived(OPENROUTER_MODELS.some((m) => m.id === settings.cloud.model));
  const modelSelectValue = $derived(
    customModelChosen || !curatedModel ? CUSTOM_MODEL : settings.cloud.model,
  );

  onMount(() => {
    void (async () => {
      prefs = await loadPrefs();
      settings = await providersItem.getValue();
      apiKey = settings.cloud.apiKey;
      loaded = true;
      await loadShortcut();
    })();
    // Stay in sync with changes made in the Toolbar Popup.
    const unwatchProviders = providersItem.watch((value) => (settings = value));
    const unwatchPrefs = prefsItem.watch((value) => (prefs = { ...DEFAULT_PREFS, ...value }));
    // The shortcut is changed on the browser's own page; refresh when coming back.
    const onFocus = () => void loadShortcut();
    window.addEventListener('focus', onFocus);
    return () => {
      unwatchProviders();
      unwatchPrefs();
      window.removeEventListener('focus', onFocus);
    };
  });

  /**
   * Saves a change. A Provider the user just set up becomes active only when
   * nothing is active yet; Glossator never picks one on its own (ADR 0002).
   */
  async function saveSettings(
    change: (current: ProviderSettings) => ProviderSettings,
    setUp?: string,
  ) {
    settings = await updateProviderSettings((current) => {
      const next = change(current);
      const usable = providerChoices(next).some((c) => c.id === setUp);
      return setUp && usable && !next.activeProviderId
        ? { ...next, activeProviderId: setUp }
        : next;
    });
  }

  // Takes the id rather than the event: the save runs after an await, when the
  // browser has already cleared event.currentTarget.
  function chooseProvider(id: string) {
    return saveSettings((current) => ({ ...current, activeProviderId: id }));
  }

  function updateCloud(change: Partial<CloudProvider>, setUp?: string) {
    return saveSettings(
      (current) => ({ ...current, cloud: { ...current.cloud, ...change } }),
      setUp,
    );
  }

  async function savePrefs(change: Partial<Prefs>) {
    prefs = await updatePrefs(change);
  }

  function inputValue(event: Event): string {
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
      await updateCloud({ apiKey: apiKey.trim() }, settings.cloud.id);
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
    const model = inputValue(event);
    customModelChosen = model === CUSTOM_MODEL;
    if (!customModelChosen) await updateCloud({ model });
  }

  async function addLocalProvider() {
    const preset = PRESETS[0];
    if (!preset) return;
    const provider: LocalProvider = {
      kind: 'local',
      id: crypto.randomUUID(),
      name: preset.label,
      preset: preset.id,
      baseUrl: preset.baseUrl,
      apiKey: '',
      model: '',
      promptProfile: 'auto',
    };
    await saveSettings((current) => ({ ...current, locals: [...current.locals, provider] }));
  }

  async function saveLocalProvider(provider: LocalProvider) {
    await saveSettings(
      (current) => ({
        ...current,
        locals: current.locals.map((p) => (p.id === provider.id ? provider : p)),
      }),
      provider.id,
    );
  }

  async function removeLocalProvider(id: string) {
    await saveSettings((current) => ({
      ...current,
      activeProviderId: current.activeProviderId === id ? null : current.activeProviderId,
      locals: current.locals.filter((p) => p.id !== id),
    }));
  }

  async function loadShortcut() {
    const command = (await browser.commands.getAll()).find((c) => c.name === 'translate-selection');
    shortcut = command?.shortcut ?? '';
  }

  async function startWith(kind: 'local' | 'cloud') {
    if (kind === 'local' && settings.locals.length === 0) await addLocalProvider();
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
        onchange={(e) => chooseProvider(e.currentTarget.value)}
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
    {#each settings.locals as provider (provider.id)}
      <LocalProviderCard
        {provider}
        onsave={saveLocalProvider}
        onremove={() => removeLocalProvider(provider.id)}
      />
    {/each}
    <div>
      <button type="button" onclick={addLocalProvider}>+ {t('localAdd')}</button>
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
        <option value={CUSTOM_MODEL}>{t('cloudModelCustom')}</option>
      </select>
    </label>
    {#if modelSelectValue === CUSTOM_MODEL}
      <label>
        <input
          value={curatedModel ? '' : settings.cloud.model}
          placeholder="vendor/model"
          spellcheck="false"
          onchange={(e) => updateCloud({ model: e.currentTarget.value.trim() })}
        />
        <span class="hint">{t('cloudModelCustomHint')}</span>
      </label>
    {/if}

    <label>
      <span class="field-label">{t('promptProfile')}</span>
      <select
        value={settings.cloud.promptProfile}
        onchange={(e) =>
          updateCloud({
            promptProfile: inputValue(e) as CloudProvider['promptProfile'],
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
        onchange={(e) => updateCloud({ strictPrivacy: e.currentTarget.checked })}
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
      <LanguageSelect
        label={t('languagesSource')}
        value={prefs.source}
        {languages}
        autoLabel={t('languageAuto')}
        onchange={(source: string) => savePrefs({ source })}
      />
      <LanguageSelect
        label={t('languagesTarget')}
        value={prefs.target}
        {languages}
        onchange={(target: string) => savePrefs({ target })}
      />
      {#if prefs.source === 'auto'}
        <LanguageSelect
          label={t('languagesFallback')}
          value={prefs.fallback}
          {languages}
          onchange={(fallback: string) => savePrefs({ fallback })}
        />
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
    <h2>{t('sectionStyle')}</h2>
    <p class="hint">{t('styleHint')}</p>
    {#if profile === 'translategemma'}
      <p class="status error">{t('extrasUnsupported')}</p>
    {/if}
    <div class="languages">
      <StyleSelect
        label={t('sectionStyle')}
        value={prefs.style}
        onchange={(style: StyleId) => savePrefs({ style })}
      />
      {#if prefs.style === 'custom'}
        <label>
          <span class="field-label">{t('styleCustom')}</span>
          <input
            value={prefs.customStyle}
            placeholder={t('styleCustomPlaceholder')}
            onchange={(e) => savePrefs({ customStyle: e.currentTarget.value.trim() })}
          />
        </label>
      {/if}
    </div>
  </section>

  <section>
    <h2>{t('sectionGlossary')}</h2>
    <p class="hint">{t('glossaryHint')}</p>
    {#if loaded}
      <GlossarySection target={prefs.target} />
    {/if}
  </section>

  <section>
    <h2>{t('sectionSelectionIcon')}</h2>
    <label class="check">
      <input
        type="checkbox"
        checked={prefs.selectionIcon}
        onchange={(e) => savePrefs({ selectionIcon: e.currentTarget.checked })}
      />
      <span>
        {t('selectionIconToggle')}
        <span class="hint">{t('selectionIconHint')}</span>
      </span>
    </label>
  </section>

  <section>
    <h2>{t('sectionShortcut')}</h2>
    {#if shortcut}
      <p><kbd>{shortcut}</kbd></p>
    {:else if shortcut === ''}
      <p class="status error">{t('shortcutMissing')}</p>
    {/if}
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

  kbd {
    font: inherit;
    font-weight: 600;
    padding: 2px 8px;
    border: 1px solid var(--g-border);
    border-radius: 6px;
    background: var(--g-bg-subtle);
  }
</style>
