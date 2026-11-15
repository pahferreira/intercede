# Bootstrap

One-time stack that the rest of `infra/` depends on. It creates, in `us-east-1`:

- `intercede-tfstate-<account-id>`: the S3 bucket for remote state, versioned, encrypted, private and TLS-only.
- The GitHub Actions OIDC provider.
- `github-actions-intercede-plan`: assumable from `pahferreira/intercede` on `main` and on pull requests. Read-only, plus writing `*.tflock` lock files in the state bucket.
- `github-actions-intercede-apply`: assumable only from `main`. Power-user access, IAM limited to roles and policies named `intercede-*`, and no changes to the state bucket's configuration.

## Apply once, locally

CI cannot create the role it would use to run, so a human applies this stack once with their own AWS credentials (an admin of the account):

```sh
cd infra/bootstrap
terraform init
terraform apply
terraform output
```

Record `state_bucket_name`, `plan_role_arn` and `apply_role_arn` for CI.

This stack keeps its state locally in `terraform.tfstate`, which is gitignored. Keep it somewhere safe; if it is lost, `terraform import` the resources before changing them. The bucket has `prevent_destroy`.

Other stacks use the bucket with native S3 locking:

```hcl
terraform {
  backend "s3" {
    bucket       = "<state_bucket_name>"
    key          = "<stack>/terraform.tfstate"
    region       = "us-east-1"
    use_lockfile = true
  }
}
```

## Checks

```sh
terraform init -backend=false
terraform validate
terraform test
```

`terraform test` runs against a mocked AWS provider and needs no credentials.
