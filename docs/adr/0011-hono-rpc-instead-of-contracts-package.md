# The web app types its API calls with Hono RPC, not a shared contracts package

`apps/web` imports `type AppType` from `apps/api` (a type-only import, so no server code ships) and calls the API through `hc<AppType>`. Request and response types are inferred from the Zod-validated routes, so API changes break the web build instead of drifting silently. A `packages/contracts` package was planned and dropped as redundant.

## Consequences

- Routes must be defined by chaining for inference to work.
- The SSE event types of the search stream are also exported as types from `apps/api`.
- `packages/` stays absent until a real shared need appears.
