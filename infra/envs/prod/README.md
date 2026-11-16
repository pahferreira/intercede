# Prod

The production stack, in `us-east-1` (ADR-0009). It creates:

- `intercede` on Neon: Postgres 18 (ADR-0003) in `aws-us-east-1`, with the `main` branch, the `intercede` role and the `intercede` database. It has `prevent_destroy`.
- `intercede-api`: the API Lambda on `nodejs24.x` ARM64 (ADR-0002) with an IAM-only Function URL that streams responses. Terraform creates it with placeholder code and ignores `filename` and `environment`; the deploy job ships the code and the secrets (ADR-0010). Its role, `intercede-api`, carries the workload boundary from bootstrap. `api_reserved_concurrency` can reserve concurrency to cap how many requests run at once (ADR-0012).
- `/aws/lambda/intercede-api`: the API's log group, kept for 7 days.
- `intercede-sweeper`: the outbox sweeper Lambda (ADR-0005), same runtime and bundle as the API, created and released the same way. Its role, `intercede-sweeper`, carries the workload boundary and may call Titan Text Embeddings v2 on Bedrock (ADR-0004). It reaches Neon through the `DATABASE_URL` the deploy job injects, so it needs no AWS permission for the database. Its log group, `/aws/lambda/intercede-sweeper`, is kept for 7 days.
- `intercede-sweeper` on EventBridge Scheduler: invokes the sweeper through the `intercede-sweeper-scheduler` role, which may invoke only that function. It runs on `var.sweeper_schedule_expression`, `rate(5 minutes)` by default, without retries: the next tick picks up whatever a missed one left.
- `intercede-monthly`: an AWS Budgets cost budget over the whole AWS account's spend, not just this stack's, that emails when the month's actual spend passes each alert threshold (ADR-0012).
- `intercede-web-<account-id>`: the private S3 bucket the SPA is served from.
- One CloudFront distribution on `intercede.pahferreira.dev`:
  - `/api/*` goes to the Function URL through origin access control, uncached.
  - `/ingest/*` goes to PostHog (`/ingest/static/*` to its assets host), uncached and without the `/ingest` prefix.
  - Everything else is the SPA from the bucket through origin access control; paths without a file extension get `index.html`.
- An ACM certificate in `us-east-1`, validated through DNS, and `A`/`AAAA` alias records in the `pahferreira.dev` zone. The zone is looked up, not owned.

## Variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `budget_alert_email` | none, required | Address AWS Budgets emails at each threshold. |
| `budget_alert_thresholds` | `[1, 5, 10]` | Monthly spend in USD that triggers an email (ADR-0012). The highest is the budget's limit. At most 5, the AWS Budgets limit on notifications per budget. |
| `api_reserved_concurrency` | `null` | Concurrent executions reserved for, and capping, the API Lambda. Null leaves it unreserved; otherwise at least 1. |
| `sweeper_reserved_concurrency` | `null` | Concurrent executions reserved for, and capping, the sweeper Lambda. Null leaves it unreserved; otherwise at least 1. |
| `sweeper_schedule_expression` | `rate(5 minutes)` | How often EventBridge Scheduler runs the sweeper, as a `rate()` or `cron()` expression. |

Pass `budget_alert_email` as `TF_VAR_budget_alert_email` (or `-var`) to every `plan` and `apply`, so the address stays out of the repository.

Both reservations default to null because Lambda refuses a reservation that leaves fewer than 10 unreserved executions in the account, and new accounts start with a limit of 10, which leaves nothing to reserve: until it is raised, the account limit is the cap. Once Service Quotas raises "Concurrent executions" (`L-B99A9384`), set `api_reserved_concurrency = 5` and `sweeper_reserved_concurrency = 1`, keeping their sum at least 10 below `aws lambda get-account-settings`' `ConcurrentExecutions`.

Budgets evaluates spend a few times a day, so an alert can arrive hours after the threshold is crossed.

## Request bodies through Lambda OAC

CloudFront signs requests to the Function URL but does not hash the body. A `PUT` or `POST` with a body is rejected unless the client sends `x-amz-content-sha256` with the SHA-256 hex digest of the body. Every write endpoint added under `/api/*` must have its client send that header.

## Secrets in state

Terraform never sets the Lambda's environment. The Neon provider does store the project's default role password and connection URIs in state (`neon_project.main`), because the Neon API returns them on creation. The state bucket is private, encrypted and TLS-only; this stack has no outputs that expose them. ADR-0010 allows this exception.

## Apply

A human applies this stack the first time, with their own AWS credentials and a Neon API key:

```sh
export NEON_API_KEY=<neon api key>
export TF_VAR_budget_alert_email=<alert address>
cd infra/envs/prod
terraform init -backend-config="bucket=<state_bucket_name>"
terraform apply
```

`<state_bucket_name>` is the bootstrap output, `intercede-tfstate-<account-id>`. The bucket is passed at `init` because it holds the account id.

Then check that a fresh plan is clean:

```sh
terraform plan -detailed-exitcode
```

Exit code `0` means no changes. Anything else is drift to fix before closing the ticket.

## Verify

Until the deploy job exists (#28), ship the API by hand. Take the pooled connection string from the Neon console, then:

```sh
export AWS_REGION=us-east-1
bun run --filter @intercede/api build
cd apps/api/dist && zip -q /tmp/intercede-api.zip api.mjs api.mjs.map && cd -
aws lambda update-function-code --function-name intercede-api --zip-file fileb:///tmp/intercede-api.zip
aws lambda wait function-updated --function-name intercede-api
aws lambda update-function-configuration --function-name intercede-api \
  --environment "Variables={DATABASE_URL=<pooled connection string>,POSTHOG_KEY=<key>}"
curl -i https://intercede.pahferreira.dev/api/health
```

Expect `200` with `{"status":"ok","database":"ok"}`.

Ship the sweeper from the same build:

```sh
cd apps/api/dist && zip -q /tmp/intercede-sweeper.zip sweeper.mjs sweeper.mjs.map && cd -
aws lambda update-function-code --function-name intercede-sweeper --zip-file fileb:///tmp/intercede-sweeper.zip
aws lambda wait function-updated --function-name intercede-sweeper
aws lambda update-function-configuration --function-name intercede-sweeper \
  --environment "Variables={DATABASE_URL=<pooled connection string>}"
aws logs tail /aws/lambda/intercede-sweeper --since 10m --follow
```

Within 5 minutes, expect one `sweeper tick: nothing to sweep` line per run.

Run `terraform plan -detailed-exitcode` again: the new code and environment must not show up as changes.

## Checks

```sh
terraform init -backend=false
terraform validate
terraform test
```

`terraform test` runs against mocked AWS and Neon providers and needs no credentials.
