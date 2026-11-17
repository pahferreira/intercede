# Testing

Agreed test seams, so a TDD run without a human in the loop uses these instead of choosing its own.

**Run tests** with `bun run test` from the repo root, or `bun test` inside `apps/api` or `apps/web`: each app's `bunfig.toml` preloads its `test/setup.ts`.

## Third-party SDKs

- Run the real SDK and fake only its network layer (`fetch`), as `apps/api/src/platform/analytics.test.ts` does with `posthog-node`.
- Where the real SDK can't run in tests, the fake is a class whose methods read `this`, so a method passed around detached from its client fails the way the real one does.

## apps/api

- Endpoint tests follow ADR-0013: `app.request(...)` against the real local Postgres, faking only external services.
- **App:** build it with `createTestApp(overrides)` from `apps/api/test/app.ts`; it wires the real adapters onto the per-test transaction.
- **Persistence adapters:** build them from `testDatabase()` (`apps/api/test/database.ts`), never a fresh `createDatabase`, so the per-test rollback reaches them.
- **Database down:** use `unreachableDatabase()` from `apps/api/test/unreachable-database.ts`. A probe that throws is the one allowed database fake, since the real probe catches every error.

## apps/web

- **Runner:** `bun test`, preloading `apps/web/test/setup.ts` (happy-dom globals, Testing Library cleanup, `localStorage` reset).
- **Lingui in tests:** `bun test` skips Vite plugins, so `apps/web/test/lingui-plugin.ts` compiles Lingui macros and `.po` catalogs for the test run. Keep it in step with the Lingui settings in `vite.config.ts`.
- **Screens:** render `<App>` with Testing Library, with an `hc` client built from the real app (`createApiClient(app.request)`, where `app = createApp({ ... })` from `@intercede/api/testing` with its ports stubbed, e.g. `isDatabaseReachable: async () => true`) and a `createMemoryHistory` at the path under test. Set the language with `switchLocale` before rendering.
- **Assertions:** what the Visitor sees (`screen.findByText`, roles), in both `en` and `pt-BR` whenever copy is involved.
- **Components:** render the component directly with Testing Library and assert its behaviour through roles and visible text, as `apps/web/src/routes/design-system.test.tsx` does. A component that needs router context (anything rendering `Link`) renders through `renderWithRouter` from `apps/web/test/render-with-router.tsx`, and its assertions use `findBy*`. No snapshots and no assertions on class names or styles.
- **Pure modules** (for example `i18n.ts`): test their exported functions directly, passing collaborators such as the catalog loader as arguments.

## Boundary rules

- `.dependency-cruiser.cjs` rules are tested in `apps/api/src/boundaries.test.ts`, which cruises small fixture trees. Each rule gets a fixture that breaks it and the nearest legitimate shape that must still pass.
- `biome-plugins/*.grit` rules are tested the same way in `apps/web/src/biome-plugins.test.ts`, which lints fixture files under the repo's `biome.json`.
- `apps/web/src/design-system-classes.test.ts` fails on any Tailwind class in `apps/web/src` that the theme in `index.css` does not generate. A size the design system lacks gets a token there, never a default-scale class.
