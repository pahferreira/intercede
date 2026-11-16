# Modular monolith with bounded contexts as modules

The API is a single Hono app deployed as one unit. Each bounded context (Intentions, Intercession) is a module under `apps/api/src/<context>/` with its own Postgres schema; other contexts may import only its `index.ts`, and there are no cross-schema joins or foreign keys. At this scale separate services would add cost and network failure modes without benefit; DDD boundaries are about the model, not the deployment.

## Consequences

- Inside a context the layers are `domain/` (pure TypeScript, no framework imports), `application/` (use cases and ports), and `adapters/` (HTTP, persistence, LLM). The folder is deliberately `adapters/`, not `infrastructure/` (clashes with Terraform's `infra/`) nor `core/` (in hexagonal architecture "core" means the inside of the hexagon, the opposite).
- Boundaries are enforced by dependency-cruiser (`.dependency-cruiser.cjs`, `bun run lint:deps`) in CI, not by convention. It parses with `@swc/core` because TypeScript 7 has no compiler API; without a supported transpiler it cruises 0 modules and still reports success. The rules, by the name a violation reports (`platform/` and `handlers/` are not contexts; `handlers/` does the wiring; each rule is tested both ways in `apps/api/src/boundaries.test.ts`):
  - `context-via-index`: code outside a context imports it only through its `index.ts`.
  - `domain-not-adapters`: `domain/` never imports from any `adapters/`.
  - `domain-no-framework`: `domain/` imports no npm package or Node built-in.
  - `domain-platform-result-only`: from `platform/`, `domain/` imports only `platform/result.ts`.
  - `no-foreign-persistence`: a context never imports another context's `adapters/persistence/`.
  - `index-not-persistence`: a context's `index.ts` never imports or re-exports its own `adapters/persistence/`. Its use cases may use their own persistence, and other contexts may import those use cases through `index.ts`.
- Expected failures (moderation rejection, rate limit) are returned as `Result` values (from `platform/result.ts`, see `CODING_STANDARDS.md`); exceptions are reserved for bugs.
- Cross-cutting technical policies (anonymous Visitor cookie, Turnstile, rate limits, token budgets, idempotency keys, transcript signing) live in `apps/api/src/platform/`, which is **not** a bounded context. Contexts depend on its ports (e.g. `TokenBudget`) and shared types such as `Result`, never on its implementations.
