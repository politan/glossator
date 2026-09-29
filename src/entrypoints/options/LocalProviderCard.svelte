<script lang="ts">
  import { untrack } from 'svelte';
  import { browser } from 'wxt/browser';
  import { t } from '@/lib/i18n';
  import { PROMPT_PROFILES } from '@/lib/prompts/profiles';
  import { PRESETS, RECOMMENDED_LOCAL_MODELS, presetById } from '@/lib/providers/presets';
  import { syncOriginRules } from '@/lib/providers/origin-sync';
  import { privacyOf } from '@/lib/providers/privacy';
  import type { LocalProvider, PresetId } from '@/lib/providers/types';
  import { TranslationError, listModels } from '@/lib/translation/client';
  import { badgeLabel } from '@/lib/ui/badge';
  import { failureText } from '@/lib/ui/errors';
  import { providersItem } from '@/lib/settings';

  interface Props {
    provider: LocalProvider;
    onsave: (server: LocalProvider) => Promise<void>;
    onremove: () => Promise<void>;
  }

  const { provider, onsave, onremove }: Props = $props();

  // Edited locally until saved, so a half-typed address is never used.
  let draft = $state<LocalProvider>(untrack(() => ({ ...provider })));
  let status = $state<{ ok: boolean; text: string } | null>(null);
  let testing = $state(false);
  let serverModels = $state<string[]>([]);

  const preset = $derived(presetById(draft.preset));
  const privacy = $derived(privacyOf(draft));
  const modelSuggestions = $derived([...new Set([...serverModels, ...RECOMMENDED_LOCAL_MODELS])]);
  const listId = $derived(`models-${draft.id}`);

  function choosePreset(event: Event) {
    const id = (event.currentTarget as HTMLSelectElement).value as PresetId;
    const next = presetById(id);
    draft.preset = id;
    draft.baseUrl = next.baseUrl;
    if (!draft.name || PRESETS.some((p) => p.label === draft.name)) {
      draft.name = next.label || t('presetCustom');
    }
  }

  /** localhost is granted at install; any other address needs the user's consent. */
  async function ensureAccess(): Promise<boolean> {
    let origin: string;
    try {
      origin = new URL(draft.baseUrl).origin;
    } catch {
      return false;
    }
    const host = new URL(origin).hostname;
    if (host === 'localhost' || host === '127.0.0.1') return true;
    return browser.permissions.request({ origins: [`${origin}/*`] });
  }

  async function test() {
    if (!(await ensureAccess())) {
      status = { ok: false, text: t('localPermissionDenied') };
      return;
    }
    testing = true;
    status = null;
    try {
      // The address may not be saved yet; give it an Origin rule now (ADR 0003).
      const saved = await providersItem.getValue();
      await syncOriginRules([...saved.locals.map((p) => p.baseUrl), draft.baseUrl]);
      serverModels = await listModels($state.snapshot(draft));
      status =
        draft.model && !serverModels.includes(draft.model)
          ? { ok: false, text: t('localTestMissing', draft.model) }
          : { ok: true, text: t('localTestOk', String(serverModels.length)) };
    } catch (error) {
      const code = error instanceof TranslationError ? error.code : 'unknown';
      status = { ok: false, text: failureText(code) };
    } finally {
      testing = false;
    }
  }

  async function save() {
    if (!(await ensureAccess())) {
      status = { ok: false, text: t('localPermissionDenied') };
      return;
    }
    await onsave($state.snapshot(draft));
    status = { ok: true, text: t('saved') };
  }
</script>

<article>
  <header>
    <strong>{draft.name || preset.label}</strong>
    <span class="badge" class:local={privacy === 'local'}>{badgeLabel(privacy, draft.name)}</span>
  </header>

  <div class="grid">
    <label>
      <span class="field-label">{t('localPreset')}</span>
      <select value={draft.preset} onchange={choosePreset}>
        {#each PRESETS as option (option.id)}
          <option value={option.id}>{option.label || t('presetCustom')}</option>
        {/each}
      </select>
    </label>
    <label>
      <span class="field-label">{t('localName')}</span>
      <input bind:value={draft.name} />
    </label>
    <label class="wide">
      <span class="field-label">{t('localBaseUrl')}</span>
      <input bind:value={draft.baseUrl} type="url" spellcheck="false" />
      <span class="hint">{t(preset.hintKey)}</span>
    </label>
    <label>
      <span class="field-label">{t('localModel')}</span>
      <input
        bind:value={draft.model}
        list={listId}
        placeholder={t('localModelPlaceholder')}
        spellcheck="false"
      />
      <datalist id={listId}>
        {#each modelSuggestions as model (model)}
          <option value={model}></option>
        {/each}
      </datalist>
    </label>
    <label>
      <span class="field-label">{t('promptProfile')}</span>
      <select bind:value={draft.promptProfile}>
        <option value="auto">{t('promptProfileAuto')}</option>
        {#each PROMPT_PROFILES as profile (profile)}
          <option value={profile}>{profile}</option>
        {/each}
      </select>
    </label>
    <label class="wide">
      <span class="field-label">{t('localKey')}</span>
      <input bind:value={draft.apiKey} type="password" autocomplete="off" />
    </label>
  </div>

  <footer>
    {#if status}
      <p class="status" class:error={!status.ok}>{status.text}</p>
    {/if}
    <div class="buttons">
      <button type="button" onclick={onremove}>{t('localRemove')}</button>
      <button type="button" disabled={testing} onclick={test}>
        {testing ? t('localTesting') : t('localTest')}
      </button>
      <button type="button" class="primary" onclick={save}>{t('localSave')}</button>
    </div>
  </footer>
</article>

<style>
  article {
    display: grid;
    gap: 12px;
    padding: 14px;
    border: 1px solid var(--g-border);
    border-radius: var(--g-radius);
    background: var(--g-bg-subtle);
  }

  header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .badge {
    font-size: 12px;
    padding: 1px 8px;
    border-radius: 999px;
    background: var(--g-cloud-bg);
    color: var(--g-text-muted);
  }

  .badge.local {
    background: var(--g-local-bg);
    color: var(--g-local);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
  }

  .wide {
    grid-column: 1 / -1;
  }

  footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .buttons {
    display: flex;
    gap: 8px;
    margin-left: auto;
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
