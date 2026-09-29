# Glossator agent guide

Chromium MV3 extension (WXT + Svelte 5 + TypeScript) that translates a selection through a Local Provider or OpenRouter.

- Read [CONTEXT.md](CONTEXT.md) for vocabulary and [docs/adr](docs/adr) before touching storage, networking or permissions. Human conventions are in [CONTRIBUTING.md](CONTRIBUTING.md).
- Commands: `pnpm test` (Vitest), `pnpm check` (svelte-check), `pnpm lint`, `pnpm format`, `pnpm build`, `pnpm verify` (everything CI runs).
- Tests only at the agreed seams: `src/lib/translation/client.ts`, `src/lib/prompts/profiles.ts`, `src/lib/pair.ts` + `src/lib/languages.ts`, `src/lib/providers/{privacy,origin-rule}.ts`. Use the fake fetch in `src/lib/translation/test-helpers.ts`; expected prompts come from model cards, not from the code.
- WXT auto-imports are off: import `browser` from `wxt/browser` and `define*` helpers from `wxt/utils/*`.
- UI strings go in both `public/_locales/en/messages.json` and `public/_locales/pl/messages.json`.
- Conventional Commits. Never edit `CHANGELOG.md` (release-please owns it). No em dashes in prose.
- Plans live in `docs/plans/`.
