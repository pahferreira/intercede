# Testing

Agreed test seams, so a TDD run without a human in the loop uses these instead of choosing its own.

## apps/api

- Endpoint tests follow ADR-0013: `app.request(...)` against the real local Postgres, faking only external services.

## apps/web

- **Runner:** `bun test`, preloading `apps/web/test/setup.ts` (happy-dom globals, Testing Library cleanup, `localStorage` reset).
- **Lingui in tests:** `bun test` skips Vite plugins, so `apps/web/test/lingui-plugin.ts` compiles Lingui macros and `.po` catalogs for the test run. Keep it in step with the Lingui settings in `vite.config.ts`.
- **Screens:** render `<App>` with Testing Library, with an `hc` client built from the real app (`createApiClient(app.request)`, where `app = createApp({ ... })` from `@intercede/api/testing` with its ports stubbed, e.g. `isDatabaseReachable: async () => true`) and a `createMemoryHistory` at the path under test. Set the language with `switchLocale` before rendering.
- **Assertions:** what the Visitor sees (`screen.findByText`, roles), in both `en` and `pt-BR` whenever copy is involved.
- **Pure modules** (for example `i18n.ts`): test their exported functions directly, passing collaborators such as the catalog loader as arguments.
