# Modular monolith with bounded contexts as modules

The API is a single Hono app deployed as one unit. Each bounded context (Intentions, Intercession) is a module under `apps/api/src/<context>/` with its own Postgres schema; other contexts may import only its `index.ts`, and there are no cross-schema joins or foreign keys. At this scale separate services would add cost and network failure modes without benefit; DDD boundaries are about the model, not the deployment.

## Consequences

- Inside a context the layers are `domain/` (pure TypeScript, no framework imports), `application/` (use cases and ports), and `adapters/` (HTTP, persistence, LLM). The folder is deliberately `adapters/`, not `infrastructure/` (clashes with Terraform's `infra/`) nor `core/` (in hexagonal architecture "core" means the inside of the hexagon, the opposite).
- Boundaries are enforced by dependency-cruiser (`.dependency-cruiser.cjs`, `bun run lint:deps`) in CI, not by convention. It parses with `@swc/core` because TypeScript 7 has no compiler API; without a supported transpiler it cruises 0 modules and still reports success.
- Expected failures (moderation rejection, rate limit) are returned as `Result` values (from `platform/result.ts`, see `CODING_STANDARDS.md`); exceptions are reserved for bugs.
- Cross-cutting technical policies (anonymous Visitor cookie, Turnstile, rate limits, token budgets, idempotency keys, transcript signing) live in `apps/api/src/platform/`, which is **not** a bounded context. Contexts depend on its ports (e.g. `TokenBudget`) and shared types such as `Result`, never on its implementations.
