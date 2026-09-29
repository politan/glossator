<svelte:options css="injected" />

<script lang="ts">
  import { onMount } from 'svelte';
  import { browser, type Browser } from 'wxt/browser';
  import { t, uiLocale } from '@/lib/i18n';
  import { languagesFor } from '@/lib/languages';
  import {
    TRANSLATE_PORT,
    type BackgroundMessage,
    type TranslateEvent,
    type TranslateRequest,
  } from '@/lib/messages';
  import { badgeLabel } from '@/lib/ui/badge';
  import { failureText, needsSettings, showsDetail } from '@/lib/ui/errors';

  type Meta = Extract<TranslateEvent, { type: 'meta' }>;
  type Failure = Extract<TranslateEvent, { type: 'error' }>;

  interface Props {
    text: string;
    context: string | null;
    onclose: () => void;
  }

  const { text, context, onclose }: Props = $props();

  // Local servers may need a while to load the model before the first token.
  const SLOW_AFTER_MS = 2500;

  let translation = $state('');
  let meta = $state<Meta | null>(null);
  let failure = $state<Failure | null>(null);
  let done = $state(false);
  let slow = $state(false);
  let copied = $state(false);
  let target = $state<string | null>(null);
  let port: Browser.runtime.Port | null = null;
  let slowTimer: ReturnType<typeof setTimeout> | undefined;

  const languages = $derived(meta ? languagesFor(meta.profile, uiLocale()) : []);
  const working = $derived(!done && !failure);

  function start(viaCloud = false) {
    port?.disconnect();
    clearTimeout(slowTimer);
    translation = '';
    meta = null;
    failure = null;
    done = false;
    slow = false;
    copied = false;

    const current = browser.runtime.connect({ name: TRANSLATE_PORT });
    port = current;
    slowTimer = setTimeout(() => (slow = true), SLOW_AFTER_MS);
    current.onMessage.addListener((event: TranslateEvent) => {
      switch (event.type) {
        case 'meta':
          meta = event;
          break;
        case 'delta':
          clearTimeout(slowTimer);
          translation += event.text;
          break;
        case 'done':
          clearTimeout(slowTimer);
          done = true;
          break;
        case 'error':
          clearTimeout(slowTimer);
          failure = event;
          break;
      }
    });
    const request: TranslateRequest = { type: 'translate', text, context, target, viaCloud };
    current.postMessage(request);
  }

  function changeTarget(event: Event) {
    target = (event.currentTarget as HTMLSelectElement).value;
    start();
  }

  async function copy() {
    await navigator.clipboard.writeText(translation.trim());
    copied = true;
    setTimeout(() => (copied = false), 1500);
  }

  function openSettings() {
    const message: BackgroundMessage = { type: 'glossator:open-settings' };
    void browser.runtime.sendMessage(message);
    onclose();
  }

  onMount(() => {
    start();
    return () => {
      clearTimeout(slowTimer);
      port?.disconnect();
    };
  });
</script>

<div class="bubble" role="dialog" aria-label={t('extName')}>
  <header>
    {#if meta}
      <label class="target">
        <span class="visually-hidden">{t('bubbleTarget')}</span>
        <select value={meta.pair.target} onchange={changeTarget}>
          {#each languages as language (language.code)}
            <option value={language.code}>{language.name}</option>
          {/each}
        </select>
      </label>
    {:else}
      <span class="brand">Glossator</span>
    {/if}
    <button class="icon-button" type="button" aria-label={t('bubbleClose')} onclick={onclose}>
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
    </button>
  </header>

  <div class="body" aria-live="polite">
    {#if failure}
      <p class="failure">{failureText(failure.code)}</p>
      {#if failure.detail && showsDetail(failure.code)}
        <p class="detail">{failure.detail}</p>
      {/if}
    {:else if translation}
      <p class="translation" dir="auto">{translation}</p>
    {:else}
      <p class="pending">
        <span class="spinner" aria-hidden="true"></span>
        {slow && meta && meta.privacy !== 'cloud'
          ? t('bubbleLoadingModel')
          : t('bubbleTranslating')}
      </p>
    {/if}
  </div>

  <footer>
    {#if meta}
      <span class="badge" class:local={meta.privacy === 'local'}>
        {#if meta.privacy === 'local'}
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 1.5l5 2v4c0 3.2-2.1 5.7-5 7-2.9-1.3-5-3.8-5-7v-4z" />
          </svg>
        {/if}
        {badgeLabel(meta.privacy, meta.providerName)}
      </span>
      <span class="model" title={meta.model}>{meta.model}</span>
    {/if}
    <span class="actions">
      {#if failure}
        {#if failure.cloudAvailable}
          <button
            type="button"
            onclick={() => {
              start(true);
            }}>{t('actionTryCloud')}</button
          >
        {/if}
        {#if needsSettings(failure.code)}
          <button type="button" onclick={openSettings}>{t('actionOpenSettings')}</button>
        {:else}
          <button
            type="button"
            onclick={() => {
              start();
            }}>{t('bubbleRetry')}</button
          >
        {/if}
      {:else if done}
        <button
          type="button"
          onclick={() => {
            start();
          }}>{t('bubbleRetry')}</button
        >
        <button type="button" class="primary" onclick={copy}>
          {copied ? t('bubbleCopied') : t('bubbleCopy')}
        </button>
      {:else if working}
        <span class="visually-hidden">{t('bubbleTranslating')}</span>
      {/if}
    </span>
  </footer>
</div>

<style>
  .bubble {
    box-sizing: border-box;
    width: min(420px, calc(100vw - 16px));
    background: var(--g-bg);
    border: 1px solid var(--g-border);
    border-radius: var(--g-radius);
    box-shadow: var(--g-shadow);
    overflow: hidden;
  }

  header,
  footer {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px 6px 12px;
  }

  header {
    border-bottom: 1px solid var(--g-border);
    justify-content: space-between;
  }

  footer {
    border-top: 1px solid var(--g-border);
    background: var(--g-bg-subtle);
    font-size: 12px;
    color: var(--g-text-muted);
    flex-wrap: wrap;
  }

  .brand {
    font-weight: 600;
  }

  select {
    font: inherit;
    font-size: 13px;
    color: var(--g-text);
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    padding: 2px 4px;
    margin-left: -5px;
    cursor: pointer;
  }

  select:hover,
  select:focus-visible {
    border-color: var(--g-border);
  }

  .body {
    padding: 10px 12px;
    max-height: 45vh;
    overflow-y: auto;
  }

  p {
    margin: 0;
  }

  .translation {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .pending,
  .detail {
    color: var(--g-text-muted);
  }

  .pending {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .failure {
    color: var(--g-danger);
  }

  .detail {
    margin-top: 4px;
    font-size: 12px;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 1px 8px;
    border-radius: 999px;
    background: var(--g-cloud-bg);
    color: var(--g-text-muted);
    font-weight: 500;
    white-space: nowrap;
  }

  .badge.local {
    background: var(--g-local-bg);
    color: var(--g-local);
  }

  .badge svg {
    width: 12px;
    height: 12px;
    fill: currentColor;
  }

  .model {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1 1 80px;
  }

  .actions {
    display: flex;
    gap: 6px;
    margin-left: auto;
  }

  button {
    font: inherit;
    font-size: 12px;
    color: var(--g-text);
    background: var(--g-bg);
    border: 1px solid var(--g-border);
    border-radius: 6px;
    padding: 3px 10px;
    cursor: pointer;
  }

  button:hover {
    border-color: var(--g-text-muted);
  }

  button.primary {
    background: var(--g-accent);
    border-color: var(--g-accent);
    color: var(--g-accent-contrast);
  }

  .icon-button {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    padding: 0;
    border-color: transparent;
    background: transparent;
  }

  .icon-button svg {
    width: 14px;
    height: 14px;
    stroke: var(--g-text-muted);
    stroke-width: 1.6;
    stroke-linecap: round;
  }

  .spinner {
    width: 12px;
    height: 12px;
    border: 2px solid var(--g-border);
    border-top-color: var(--g-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation-duration: 2.4s;
    }
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
</style>
