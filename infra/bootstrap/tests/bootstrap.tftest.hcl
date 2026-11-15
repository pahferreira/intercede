mock_provider "aws" {
  mock_data "aws_caller_identity" {
    defaults = {
      account_id = "123456789012"
    }
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

run "oidc_provider_trusts_github_for_sts" {
  command = plan

  assert {
    condition     = aws_iam_openid_connect_provider.github.url == "https://token.actions.githubusercontent.com"
    error_message = "The OIDC provider must be GitHub Actions."
  }

  assert {
    condition     = aws_iam_openid_connect_provider.github.client_id_list == toset(["sts.amazonaws.com"])
    error_message = "The OIDC audience must be STS."
  }
}

run "plan_role_is_assumable_from_main_and_pull_requests_only" {
  command = apply

  assert {
    condition = toset(jsondecode(aws_iam_role.plan.assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:sub"]) == toset([
      "repo:pahferreira/intercede:ref:refs/heads/main",
      "repo:pahferreira/intercede:pull_request",
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
    condition     = jsondecode(aws_iam_role.apply.assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:sub"] == "repo:pahferreira/intercede:ref:refs/heads/main"
    error_message = "The apply role must trust only main of pahferreira/intercede."
  }

  assert {
    condition     = jsondecode(aws_iam_role.apply.assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:aud"] == "sts.amazonaws.com"
    error_message = "The apply role must require the STS audience."
  }
}
