mock_provider "aws" {
  mock_data "aws_caller_identity" {
    defaults = {
      account_id = "123456789012"
    }
  }
}

override_data {
  target = data.aws_iam_openid_connect_provider.github
  values = {
    arn            = "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
    client_id_list = ["sts.amazonaws.com"]
  }
}

run "state_bucket_is_versioned_and_private" {
  command = plan

  assert {
    condition     = aws_s3_bucket.state.bucket == "intercede-tfstate-123456789012"
    error_message = "The state bucket name must include the account id."
  }

  assert {
    condition     = aws_s3_bucket_versioning.state.versioning_configuration[0].status == "Enabled"
    error_message = "The state bucket must be versioned."
  }

  assert {
    condition = alltrue([
      aws_s3_bucket_public_access_block.state.block_public_acls,
      aws_s3_bucket_public_access_block.state.block_public_policy,
      aws_s3_bucket_public_access_block.state.ignore_public_acls,
      aws_s3_bucket_public_access_block.state.restrict_public_buckets,
    ])
    error_message = "The state bucket must block all public access."
  }
}

run "roles_trust_the_existing_github_oidc_provider" {
  command = plan

  assert {
    condition     = data.aws_iam_openid_connect_provider.github.url == "https://token.actions.githubusercontent.com"
    error_message = "The roles must trust the GitHub Actions OIDC provider."
  }

  assert {
    condition = alltrue([
      for role in [aws_iam_role.plan, aws_iam_role.apply] :
      jsondecode(role.assume_role_policy).Statement[0].Principal.Federated == "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
    ])
    error_message = "Both roles must trust the existing provider's ARN."
  }
}

run "existing_github_oidc_provider_must_accept_sts" {
  command = plan

  override_data {
    target = data.aws_iam_openid_connect_provider.github
    values = {
      arn            = "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
      client_id_list = ["some-other-audience"]
    }
  }

  expect_failures = [data.aws_iam_openid_connect_provider.github]
}

run "plan_role_is_assumable_from_main_and_pull_requests_only" {
  command = apply

  assert {
    condition = toset(jsondecode(aws_iam_role.plan.assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:sub"]) == toset([
      "repo:pahferreira@28626385/intercede@1457058709:ref:refs/heads/main",
      "repo:pahferreira@28626385/intercede@1457058709:pull_request",
    ])
    error_message = "The plan role must trust only main and pull requests of pahferreira/intercede."
  }

  assert {
    condition     = jsondecode(aws_iam_role.plan.assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:aud"] == "sts.amazonaws.com"
    error_message = "The plan role must require the STS audience."
  }

  assert {
    condition     = aws_iam_role_policy_attachment.plan_read_only.policy_arn == "arn:aws:iam::aws:policy/ReadOnlyAccess"
    error_message = "The plan role must be read-only outside the state bucket."
  }
}

run "apply_role_is_assumable_from_main_only" {
  command = apply

  assert {
    condition     = jsondecode(aws_iam_role.apply.assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:sub"] == "repo:pahferreira@28626385/intercede@1457058709:ref:refs/heads/main"
    error_message = "The apply role must trust only main of pahferreira/intercede."
  }

  assert {
    condition     = jsondecode(aws_iam_role.apply.assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:aud"] == "sts.amazonaws.com"
    error_message = "The apply role must require the STS audience."
  }
}

run "state_bucket_denies_insecure_transport" {
  command = plan

  assert {
    condition     = jsondecode(aws_s3_bucket_policy.state.policy).Statement[0].Condition.Bool["aws:SecureTransport"] == "false" && jsondecode(aws_s3_bucket_policy.state.policy).Statement[0].Effect == "Deny"
    error_message = "The state bucket must deny requests without TLS."
  }
}

run "plan_role_writes_only_lock_files" {
  command = apply

  assert {
    condition     = jsondecode(aws_iam_role_policy.plan_state_lock.policy).Statement[0].Resource == "${aws_s3_bucket.state.arn}/*.tflock"
    error_message = "The plan role may write only lock files in the state bucket."
  }
}

run "apply_role_can_only_manage_roles_inside_the_workload_boundary" {
  command = apply

  assert {
    condition     = aws_iam_policy.workload_boundary.name == "github-actions-intercede-workload-boundary"
    error_message = "The boundary must sit outside the intercede-* prefix the apply role can edit."
  }

  assert {
    condition = anytrue([
      for statement in jsondecode(aws_iam_policy.workload_boundary.policy).Statement :
      statement.Effect == "Deny" && contains(statement.Action, "iam:*") && contains(statement.Action, "sts:AssumeRole")
    ])
    error_message = "Workload roles must not reach IAM or assume other roles."
  }

  assert {
    condition = anytrue([
      for statement in jsondecode(aws_iam_role_policy.apply_scoped.policy).Statement :
      statement.Effect == "Deny"
      && contains(statement.Action, "iam:CreateRole")
      && contains(statement.Action, "iam:AttachRolePolicy")
      && contains(statement.Action, "iam:PutRolePolicy")
      && try(statement.Condition.StringNotEquals["iam:PermissionsBoundary"], "") == aws_iam_policy.workload_boundary.arn
    ])
    error_message = "The apply role must not create or grant roles without the workload boundary."
  }

  assert {
    condition = anytrue([
      for statement in jsondecode(aws_iam_role_policy.apply_scoped.policy).Statement :
      statement.Effect == "Deny" && contains(statement.Action, "iam:DeleteRolePermissionsBoundary")
    ])
    error_message = "The apply role must not remove the workload boundary."
  }
}
