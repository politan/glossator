<svelte:options css="injected" />

<script lang="ts">
  import { t } from '@/lib/i18n';

  interface Props {
    onactivate: () => void;
  }

  const { onactivate }: Props = $props();
</script>

<button
  type="button"
  title={t('selectionIconLabel')}
  aria-label={t('selectionIconLabel')}
  onmousedown={(event) => {
    // Keep the page's selection alive while clicking.
    event.preventDefault();
  }}
  onclick={onactivate}
>
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 4h11a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-5l-4 3.5V16H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z" />
    <path class="glyph" d="M13.5 8.2A3.2 3.2 0 1 0 13.6 12H11" />
  </svg>
</button>

<style>
  button {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    padding: 0;
    border: 1px solid var(--g-border);
    border-radius: 8px;
    background: var(--g-bg);
    box-shadow: var(--g-shadow);
    cursor: pointer;
  }

  button:hover {
    border-color: var(--g-accent);
  }

  svg {
    width: 20px;
    height: 20px;
  }

  path {
    fill: var(--g-accent);
  }

  .glyph {
    fill: none;
    stroke: var(--g-accent-contrast);
    stroke-width: 1.8;
    stroke-linecap: round;
  }
</style>
