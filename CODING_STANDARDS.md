# Coding standards

Judgement rules for review. Biome, tsc and dependency-cruiser enforce the mechanical ones; they are not repeated here.

## Failures

- Expected failures (moderation rejection, rate limit, an unreachable dependency the endpoint reports on) are returned as `Result` values; `throw` is for bugs (ADR-0001).
- `Result` is `{ ok: true; value: T } | { ok: false; error: E }`, exported from `apps/api/src/platform/result.ts`. The first change that needs it adds that file; every later one imports it.
- A yes/no check with a single failure reason may return `boolean` instead.

## Configuration

- Deployed entry points (`apps/api/src/handlers/*`) read required configuration when the module loads and throw if it is missing.
- Local defaults (such as the Docker `DATABASE_URL`) live only in `dev.ts` and tooling configs.
- Each setting is resolved in one place.
- A setting shared across apps (a port, a URL) uses the same env var name everywhere it is read.

## Scope

- Export only what a caller uses today. Code for a later ticket arrives with that ticket.
- A placeholder file is acceptable only when a tool needs it to run (e.g. drizzle-kit needs one schema file).
- A closed set of values (locales, statuses, route paths) is declared once; every other site derives from it.

## Boundaries

- `apps/web` production code imports `@intercede/api` only with `import type` (ADR-0011). Tests reach the running app through `@intercede/api/testing`, never through a relative path into `apps/api/src`.

## Comments

- Write a comment only when the code cannot carry the reason: a workaround, an external constraint, a non-obvious invariant. One line.

## Naming

- Domain names use the terms in `GLOSSARY.md`.

## Language

- Identifiers, docs and source copy are in English. Visitor-facing copy goes through Lingui with `en` as the source locale, and every message ships with its `pt-BR` translation in the same change, as polished as the English.
