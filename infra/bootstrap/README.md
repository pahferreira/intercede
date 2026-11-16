# Bootstrap

One-time stack that the rest of `infra/` depends on. It creates, in `us-east-1`:

- `intercede-tfstate-<account-id>`: the S3 bucket for remote state, versioned, encrypted, private and TLS-only.
- No GitHub Actions OIDC provider. An account holds only one provider per URL, and this account shares it with other projects, so the stack looks it up rather than owning it. It must already exist and accept the `sts.amazonaws.com` audience; on a fresh account, create it once by hand first.
- `github-actions-intercede-plan`: assumable from `pahferreira/intercede` on `main` and on pull requests. Read-only, plus writing `*.tflock` lock files in the state bucket.
- `github-actions-intercede-apply`: assumable only from `main`. Power-user access, IAM limited to roles and policies named `intercede-*`, and no changes to the state bucket's configuration.
- `github-actions-intercede-workload-boundary`: the permissions boundary every role the apply role creates must carry. It blocks IAM and role chaining, so a workload role can never grant more than the apply role already has.

The repository uses GitHub's immutable OIDC subject, so tokens name the owner and repository by id as well as by name: `repo:pahferreira@28626385/intercede@1457058709:<context>`. Both roles trust only that form, so a renamed or recreated repository with the same name can't assume them. Check the prefix with `gh api repos/pahferreira/intercede/actions/oidc/customization/sub`.

## Rules for the stacks CI applies

- Name every IAM role and policy `intercede-*`, and set `permissions_boundary` on each role to `workload_permissions_boundary_arn`. Otherwise `apply` is denied.
- Don't set `environment:` on jobs that assume these roles: it changes the OIDC subject to `repo:pahferreira@28626385/intercede@1457058709:environment:<name>`, which neither role trusts.
- Never use the `pull_request_target` trigger: it runs with the `main` subject and could assume the apply role.
- The plan role is read-only, but that includes Lambda configuration, so PR workflows can read the function's environment (ADR-0010 secrets). Only trusted collaborators should be able to push branches.

## Apply, locally

CI cannot change the roles it runs as, so a human applies this stack with their own AWS credentials (an admin of the account). Its state lives in the bucket it creates, under `bootstrap/terraform.tfstate`, so every checkout shares it:

```sh
cd infra/bootstrap
terraform init -backend-config="bucket=intercede-tfstate-<account-id>"
terraform apply
terraform output
```

Record `state_bucket_name`, `plan_role_arn`, `apply_role_arn` and `workload_permissions_boundary_arn` for CI and the prod stack.

On a fresh account the bucket doesn't exist yet. Run `terraform init -backend=false` and `terraform apply` with local state first, then move it into the bucket with `terraform init -migrate-state -backend-config="bucket=<state_bucket_name>"` and delete the local `terraform.tfstate`. The bucket is versioned and has `prevent_destroy`; if the state is ever lost, `terraform import` the resources before changing them.

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
