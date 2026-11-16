# Secrets live in GitHub Secrets and never pass through Terraform

The Neon URL, Turnstile secret, PostHog key, and signing keys are GitHub Secrets. The deploy job injects them as Lambda environment variables with `update-function-configuration`. Terraform creates the function with placeholder code and `ignore_changes = [filename, environment]`. Passing secrets as `TF_VAR_*` would write them into Terraform state in plaintext. SSM Parameter Store was considered and dropped for simplicity.

## Consequences

- Rotating a secret means editing it in GitHub and redeploying.
- Values are readable in the Lambda console by anyone with access to the AWS account (only the owner today).
- One exception: credentials a provider generates itself land in state. The Neon provider stores the project's role password and connection URIs because the Neon API returns them on creation. They stay only in the private, encrypted, TLS-only state bucket, no stack outputs expose them, and the Lambda still gets its Neon URL from GitHub Secrets. Keeping them out of state would mean creating the Neon project outside Terraform.
- CI assumes an AWS role through GitHub OIDC; there are no long-lived AWS keys. The account's GitHub OIDC provider is shared with other projects (one per URL per account), so Terraform looks it up and does not own it. Jobs run only for the scopes a change touches (`infra`, `api`, `migrations`, `web`), and a weekly `terraform plan` catches drift.
