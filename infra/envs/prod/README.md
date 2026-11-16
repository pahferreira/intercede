# Prod

The production stack, in `us-east-1` (ADR-0009). It creates:

- `intercede` on Neon: Postgres 18 (ADR-0003) in `aws-us-east-1`, with the `main` branch, the `intercede` role and the `intercede` database. It has `prevent_destroy`.
- `intercede-api`: the API Lambda on `nodejs24.x` ARM64 (ADR-0002) with an IAM-only Function URL that streams responses. Terraform creates it with placeholder code and ignores `filename` and `environment`; the deploy job ships the code and the secrets (ADR-0010). Its role, `intercede-api`, carries the workload boundary from bootstrap.
- `/aws/lambda/intercede-api`: the API's log group, kept for 7 days.
- `intercede-web-<account-id>`: the private S3 bucket the SPA is served from.
- One CloudFront distribution on `intercede.pahferreira.dev`:
  - `/api/*` goes to the Function URL through origin access control, uncached.
  - `/ingest/*` goes to PostHog (`/ingest/static/*` to its assets host), uncached and without the `/ingest` prefix.
  - Everything else is the SPA from the bucket through origin access control; paths without a file extension get `index.html`.
- An ACM certificate in `us-east-1`, validated through DNS, and `A`/`AAAA` alias records in the `pahferreira.dev` zone. The zone is looked up, not owned.

The sweeper (#25) and cost guards (#26) are not here yet.

## Request bodies through Lambda OAC

CloudFront signs requests to the Function URL but does not hash the body. A `PUT` or `POST` with a body is rejected unless the client sends `x-amz-content-sha256` with the SHA-256 hex digest of the body. Every write endpoint added under `/api/*` must have its client send that header.

## Secrets in state

Terraform never sets the Lambda's environment. The Neon provider does store the project's default role password and connection URIs in state (`neon_project.main`), because the Neon API returns them on creation. The state bucket is private, encrypted and TLS-only; this stack has no outputs that expose them. ADR-0010 allows this exception.

## Apply

A human applies this stack the first time, with their own AWS credentials and a Neon API key:

```sh
export NEON_API_KEY=<neon api key>
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

Expect `200` with `{"status":"ok","database":"ok"}`. Run `terraform plan -detailed-exitcode` again: the new code and environment must not show up as changes.

## Checks

```sh
terraform init -backend=false
terraform validate
terraform test
```

`terraform test` runs against mocked AWS and Neon providers and needs no credentials.
