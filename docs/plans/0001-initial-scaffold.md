# Plan 0001: initial scaffold

Goal: a working Glossator v0.1 for Chromium MV3 that translates a Selection in a Bubble through either OpenRouter or a Local Provider, plus the project tooling, CI and README. Vocabulary follows [CONTEXT.md](../../CONTEXT.md); architecture follows ADRs 0001-0004.

## Stack

WXT + Svelte 5 + TypeScript (6.0, strict), pnpm, Vitest. ESLint flat config (typescript-eslint strict, eslint-plugin-svelte), Prettier, husky + lint-staged, commitlint, release-please, Dependabot.

## Layout

```
src/
  entrypoints/
    background.ts          context menu, command, onboarding, translate port, DNR sync
    content/               Selection Icon + Bubble (Shadow DOM), registration: runtime
    popup/                 Toolbar Popup
    options/               Settings + onboarding
  lib/
    translation/           streamTranslation (SSE client), error mapping
    prompts/               Prompt Profiles
    languages.ts           language lists per Prompt Profile
    pair.ts                Language Pair resolution (Auto, Fallback Language, Swap, length limit)
    providers/             presets, OpenRouter models, privacy classification, Origin rule
    settings.ts            storage (prefs in sync, Providers + keys in local)
    messages.ts            port / runtime message types
  public/_locales/{en,pl}  UI strings
```

## Test seams (agreed)

1. Translation client: `streamTranslation(provider, messages, signal)` against a fake `fetch`.
2. Prompt Profiles: profile resolution by model id and exact messages per profile.
3. Translation decisions: Language Pair resolution, Swap, length limit, languages per profile.
4. Provider and privacy: Privacy Badge classification, Origin rewrite rule.

UI is verified by hand in Brave.

## Steps

1. Tooling scaffold: package.json, configs, CI, release-please, Dependabot, templates.
2. TDD the four seams (vertical slices).
3. Background wiring: port protocol, cache, context menu, command, onboarding, DNR sync, permission-driven content script registration.
4. UI: Bubble + Selection Icon, Toolbar Popup, Settings/onboarding, i18n EN/PL.
5. Logo + icons, README, CONTRIBUTING, AGENTS.md.
6. Verify: lint, typecheck, full test suite, build, zip. Code review. Commit.
