# Intercede

## Running locally

Requirements: [Bun](https://bun.sh) 1.4 and Docker.

```sh
bun install
docker compose up -d
bun run db:migrate
bun run --filter @intercede/api dev
```

- `docker compose up` starts Postgres 18 with pgvector, matching Neon's Postgres major version.
- `bun run db:migrate` applies the SQL migrations in `apps/api/drizzle/`.
- The API listens on `http://localhost:3000`; `GET /api/health` reports whether the database is reachable.

The API and migrations connect to `postgres://intercede:intercede@localhost:5432/intercede` unless `DATABASE_URL` is set.

To reset the database, run `docker compose down -v`.

## Checks

```sh
bun run lint
bun run typecheck
bun run test
```

Tests do not need a running database.

## Migrations

Drizzle schemas live in `apps/api/src/*/adapters/persistence/schema.ts`. After changing one, generate a migration with:

```sh
bun run --filter @intercede/api db:generate
```
