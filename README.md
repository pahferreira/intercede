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

Locally, Turnstile uses Cloudflare's always-passing test keys unless `TURNSTILE_SITE_KEY` (web) and `TURNSTILE_SECRET_KEY` (API) are set. A Visitor may submit 3 Intentions a day; `SUBMISSIONS_PER_VISITOR_PER_DAY` changes that.

A Visitor may run 20 search turns an hour (`SEARCH_TURNS_PER_VISITOR_PER_HOUR`), and searches stop for everyone once the day's LLM tokens reach 2,000,000 (`SEARCH_TOKENS_PER_DAY`). Clarifying Questions are signed with `TRANSCRIPT_SIGNING_KEY`, which has a local default.

## Checks

```sh
bun run lint
bun run typecheck
bun run test
```

Tests need the local Postgres (`docker compose up -d --wait`). They create and migrate a separate `intercede_test` database on it, so the dev `intercede` database is never touched, and roll back each test's writes. The Compose project is named `intercede`, so every worktree shares one container; stop it with `docker compose down` when you are done.

## Infrastructure

Terraform lives in `infra/`. Start with `infra/bootstrap`, which a human applies once; see its README.
