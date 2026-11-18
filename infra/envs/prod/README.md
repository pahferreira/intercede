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

| Variable                       | Default           | Purpose                                                                                                                                                  |
| ------------------------------ | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `budget_alert_email`           | none, required    | Address AWS Budgets emails at each threshold.                                                                                                            |
| `budget_alert_thresholds`      | `[1, 5, 10]`      | Monthly spend in USD that triggers an email (ADR-0012). The highest is the budget's limit. At most 5, the AWS Budgets limit on notifications per budget. |
| `api_reserved_concurrency`     | `null`            | Concurrent executions reserved for, and capping, the API Lambda. Null leaves it unreserved; otherwise at least 1.                                        |
| `sweeper_reserved_concurrency` | `null`            | Concurrent executions reserved for, and capping, the sweeper Lambda. Null leaves it unreserved; otherwise at least 1.                                    |
| `sweeper_schedule_expression`  | `rate(5 minutes)` | How often EventBridge Scheduler runs the sweeper, as a `rate()` or `cron()` expression.                                                                  |

Pass `budget_alert_email` as `TF_VAR_budget_alert_email` (or `-var`) to every `plan` and `apply`, so the address stays out of the repository. The variable is sensitive, so plans, including the one CI posts on public pull requests, don't print it.

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

## Deploy

After the first apply, `.github/workflows/deploy.yml` deploys every push to `main` that changes more than Markdown, and runs again on demand from the Actions tab. One job, assuming `AWS_APPLY_ROLE_ARN`, runs in order:

1. `terraform apply` on this stack, reading the function names, web bucket, distribution and site URL from its outputs.
2. Drizzle migrations against Neon. `DATABASE_URL` is the pooled connection string; migrations use the direct one, the same URL without `-pooler` in the host. The job fails if the secret has no `-pooler` host.
3. The API and sweeper builds, each zipped with its source map and shipped after their environment, so new code never starts without a setting it requires. The environment goes through `update-function-configuration` (ADR-0010): `DATABASE_URL` and `POSTHOG_KEY` for both the API and the sweeper.
4. The web build, synced to the bucket (hashed `assets/` cached for a year, everything else `no-cache`), then a CloudFront invalidation of `/*`. Old hashed assets stay, so pages already open keep loading their chunks.
5. A check that `/api/health` and `/` answer on `intercede.pahferreira.dev`.

Every step is safe to re-run. A new run waits for the one in progress, and only the latest waiting run goes ahead.

| Name                 | Kind     | Used for                                      |
| -------------------- | -------- | --------------------------------------------- |
| `AWS_APPLY_ROLE_ARN` | variable | The role the job assumes through GitHub OIDC. |
| `TF_STATE_BUCKET`    | variable | `terraform init`'s backend bucket.            |
| `NEON_API_KEY`       | secret   | The Neon provider.                            |
| `BUDGET_ALERT_EMAIL` | secret   | `TF_VAR_budget_alert_email`.                  |
| `DATABASE_URL`       | secret   | Neon's pooled connection string.              |
| `POSTHOG_KEY`        | secret   | The API's environment and the web build.      |

After a deploy, `terraform plan -detailed-exitcode` must still exit `0`: the new code and environment don't show up as changes.

## Checks

```sh
terraform init -backend=false
terraform validate
terraform test
```

`terraform test` runs against mocked AWS and Neon providers and needs no credentials.
