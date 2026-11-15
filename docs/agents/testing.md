# Testing

Agreed test seams, so a TDD run without a human in the loop uses these instead of choosing its own.

## apps/api

- Drive the Hono app through `app.request(...)` and assert on the HTTP response. No server is started.

## apps/web

- **Runner:** `bun test`, preloading `apps/web/test/setup.ts` (happy-dom globals, Testing Library cleanup, `localStorage` reset).
- **Lingui in tests:** `bun test` skips Vite plugins, so `apps/web/test/lingui-plugin.ts` compiles Lingui macros and `.po` catalogs for the test run. Keep it in step with the Lingui settings in `vite.config.ts`.
- **Screens:** render `<App>` with Testing Library, with an `hc` client built from the real app (`createApiClient(app.request)`, `app` from `@intercede/api/testing`) and a `createMemoryHistory` at the path under test. Set the language with `switchLocale` before rendering.
- **Assertions:** what the Visitor sees (`screen.findByText`, roles), in both `en` and `pt-BR` whenever copy is involved.
- **Pure modules** (for example `i18n.ts`): test their exported functions directly, passing collaborators such as the catalog loader as arguments.
