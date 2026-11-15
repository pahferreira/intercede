# Endpoint tests run against real Postgres; only external services are faked

The behaviour most likely to break lives in the database: the Intention and its outbox row in one transaction, one Commitment per Visitor per Intention per day, "suggested in the last 24 h", idempotent sweeper runs, and pgvector ranking with a language filter. An in-memory fake of any of these is a second implementation that can pass while the real SQL is wrong. So endpoint tests go through the Hono app (`app.request`) with the real persistence adapters against the local Docker Postgres, and assert on the response and, where it matters, on the rows.

Only services that are slow, paid, or nondeterministic are faked, through injected ports: Bedrock (moderation, embeddings, the agent turn), Turnstile and PostHog. Pure domain rules stay in plain unit tests.

## Considered Options

- **In-memory repository fakes for endpoint tests**: fast and Docker-free, but can't prove transactions, constraints, time windows or vector search.
- **A separate `test:integration` script**: keeps `bun run test` Docker-free, but becomes the suite nobody runs.

## Consequences

- `bun run test` needs the local database (`docker compose up -d --wait`). The test setup fails with that instruction when Postgres is unreachable; it never skips silently.
- Tests use a dedicated `intercede_test` database, migrated once per run, and each test runs in a transaction that is rolled back, so tests are isolated and fast.
- CI runs the same suite with a `pgvector/pgvector` service container on the same tag as `docker-compose.yml`.
- The pre-push hook runs the same suite, so Docker must be up to push.
- Context: ADR-0001, ADR-0003, ADR-0007.
