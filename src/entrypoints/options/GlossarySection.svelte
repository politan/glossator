<script lang="ts">
  import { onMount } from 'svelte';
  import type { TermPair } from '@/lib/glossary';
  import { GLOSSARY_LIMIT, loadGlossary, removeTermPair, saveTermPair } from '@/lib/glossary-store';
  import { t, uiLocale } from '@/lib/i18n';
  import { languagesFor } from '@/lib/languages';

  interface Props {
    /** Language the user usually translates into; new pairs start with it. */
    target: string;
  }

  const { target }: Props = $props();

  let entries = $state<TermPair[]>([]);
  const languages = languagesFor('generic', uiLocale());
  const full = $derived(entries.length >= GLOSSARY_LIMIT);

  onMount(async () => {
    entries = await loadGlossary();
  });

  async function add() {
    const entry: TermPair = {
      id: crypto.randomUUID(),
      langA: target === 'en' ? 'pl' : 'en',
      termA: '',
      langB: target,
      termB: '',
    };
    entries = [...entries, entry];
    await saveTermPair(entry);
  }

  async function update(entry: TermPair, change: Partial<TermPair>) {
    const next = { ...entry, ...change };
    entries = entries.map((e) => (e.id === entry.id ? next : e));
    await saveTermPair(next);
  }

  async function remove(id: string) {
    entries = entries.filter((e) => e.id !== id);
    await removeTermPair(id);
  }
</script>

{#if entries.length === 0}
  <p class="hint">{t('glossaryEmpty')}</p>
{:else}
  <ul>
    {#each entries as entry (entry.id)}
      <li>
        <select
          aria-label={t('glossaryTermPlaceholder')}
          value={entry.langA}
          onchange={(e) => update(entry, { langA: e.currentTarget.value })}
        >
          {#each languages as language (language.code)}
            <option value={language.code}>{language.name}</option>
          {/each}
        </select>
        <input
          value={entry.termA}
          placeholder={t('glossaryTermPlaceholder')}
          spellcheck="false"
          onchange={(e) => update(entry, { termA: e.currentTarget.value.trim() })}
        />
        <span class="both-ways" aria-hidden="true">⇄</span>
        <select
          aria-label={t('glossaryTermPlaceholder')}
          value={entry.langB}
          onchange={(e) => update(entry, { langB: e.currentTarget.value })}
        >
          {#each languages as language (language.code)}
            <option value={language.code}>{language.name}</option>
          {/each}
        </select>
        <input
          value={entry.termB}
          placeholder={t('glossaryTermPlaceholder')}
          spellcheck="false"
          onchange={(e) => update(entry, { termB: e.currentTarget.value.trim() })}
        />
        <button type="button" onclick={() => remove(entry.id)}>{t('glossaryRemove')}</button>
      </li>
    {/each}
  </ul>
{/if}

<div class="footer">
  <button type="button" disabled={full} onclick={add}>+ {t('glossaryAdd')}</button>
  <span class="hint">
    {full
      ? t('glossaryFull')
      : t('glossaryCount', [String(entries.length), String(GLOSSARY_LIMIT)])}
  </span>
</div>

<style>
  ul {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
    grid-template-columns: minmax(90px, 0.8fr) 1fr auto minmax(90px, 0.8fr) 1fr auto;
    align-items: center;
    gap: 6px;
  }

  .both-ways {
    color: var(--g-text-muted);
  }

  .footer {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  @media (max-width: 640px) {
    li {
      grid-template-columns: 1fr 1fr;
    }

    .both-ways {
      display: none;
    }
  }
</style>
