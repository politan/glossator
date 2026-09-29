<script lang="ts">
  import type { Language } from '../languages';

  interface Props {
    label: string;
    value: string;
    languages: Language[];
    /** Label of the Auto option; the option is left out when not given. */
    autoLabel?: string;
    onchange: (code: string) => void;
  }

  const { label, value, languages, autoLabel, onchange }: Props = $props();
</script>

<label>
  <span class="field-label">{label}</span>
  <select
    {value}
    onchange={(event) => {
      onchange(event.currentTarget.value);
    }}
  >
    {#if autoLabel}
      <option value="auto">{autoLabel}</option>
    {/if}
    {#each languages as language (language.code)}
      <option value={language.code}>{language.name}</option>
    {/each}
  </select>
</label>
