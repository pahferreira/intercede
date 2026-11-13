# Lambda on the Node 24 runtime; Bun only for tooling

The API runs on AWS Lambda (`nodejs24.x`, ARM64) behind a Function URL with response streaming, built with `bun build --target=node`. Bun is the package manager, test runner, and dev server, but not the production runtime: running Bun on Lambda needs a custom runtime layer (slower cold starts, extra maintenance, limited streaming support), and always-on Bun hosts (App Runner, ECS, EC2) cost money every month. Hono runs the same code on both, and Lambda's free tier keeps the bill near zero.

## Considered Options

- **API Gateway HTTP API**: rejected because it cannot stream responses, which the search experience needs.

## Consequences

- One bundle, two functions: `api` (Function URL) and `sweeper` (EventBridge Scheduler), so background work never competes with the API's reserved concurrency.
- Terraform owns the function's shape; the deploy pipeline owns releases (code and environment). See ADR-0010.
