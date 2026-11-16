# Intercede

## Running locally

Requirements: [Bun](https://bun.sh) 1.4 and Docker.

```sh
bun install
docker compose up -d --wait
bun run db:migrate
bun run --filter @intercede/api dev
```

- `docker compose up -d --wait` starts Postgres 18 with pgvector and waits until it accepts connections.
- `bun run db:migrate` applies the SQL migrations in `apps/api/drizzle/`.
- The API listens on `http://localhost:3000`; `GET /api/health` reports whether the database is reachable.

Locally, the API and migrations connect to `postgres://intercede:intercede@localhost:5432/intercede` unless `DATABASE_URL` is set.

To reset the database, run `docker compose down -v`.

Analytics stay off unless `POSTHOG_KEY` is set; the API and the web app read the same variable. `POSTHOG_HOST` defaults to `https://us.i.posthog.com`.

## Checks

```sh
bun run lint
bun run typecheck
bun run test
```

Tests need the local Postgres (`docker compose up -d --wait`). They create and migrate a separate `intercede_test` database on it, so the dev `intercede` database is never touched, and roll back each test's writes.

## Infrastructure

Terraform lives in `infra/`. Start with `infra/bootstrap`, which a human applies once; see its README.
