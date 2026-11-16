mock_provider "aws" {
  mock_data "aws_caller_identity" {
    defaults = {
      account_id = "123456789012"
    }
  }

  mock_data "aws_iam_policy" {
    defaults = {
      arn = "arn:aws:iam::123456789012:policy/github-actions-intercede-workload-boundary"
    }
  }

  mock_resource "aws_iam_role" {
    defaults = {
      arn = "arn:aws:iam::123456789012:role/intercede-api"
    }
  }

  mock_resource "aws_cloudwatch_log_group" {
    defaults = {
      arn = "arn:aws:logs:us-east-1:123456789012:log-group:/aws/lambda/intercede-api"
    }
  }

  mock_resource "aws_lambda_function_url" {
    defaults = {
      function_url = "https://abc123.lambda-url.us-east-1.on.aws/"
    }
  }

  mock_data "aws_route53_zone" {
    defaults = {
      zone_id = "Z0123456789EXAMPLE"
    }
  }

  mock_resource "aws_acm_certificate" {
    defaults = {
      arn = "arn:aws:acm:us-east-1:123456789012:certificate/11111111-2222-3333-4444-555555555555"
      domain_validation_options = [{
        domain_name           = "intercede.pahferreira.dev"
        resource_record_name  = "_abc.intercede.pahferreira.dev."
        resource_record_type  = "CNAME"
        resource_record_value = "_xyz.acm-validations.aws."
      }]
    }
  }

  mock_resource "aws_acm_certificate_validation" {
    defaults = {
      certificate_arn = "arn:aws:acm:us-east-1:123456789012:certificate/11111111-2222-3333-4444-555555555555"
    }
  }

  mock_resource "aws_cloudfront_distribution" {
    defaults = {
      arn = "arn:aws:cloudfront::123456789012:distribution/EDFDVBD6EXAMPLE"
    }
  }
}

mock_provider "neon" {}

override_resource {
  target = aws_cloudfront_function.strip_ingest_prefix
  values = {
    arn = "arn:aws:cloudfront::123456789012:function/intercede-strip-ingest-prefix"
  }
}

override_resource {
  target = aws_cloudfront_function.spa_routes
  values = {
    arn = "arn:aws:cloudfront::123456789012:function/intercede-spa-routes"
  }
}

override_resource {
  target = aws_lambda_function.sweeper
  values = {
    arn = "arn:aws:lambda:us-east-1:123456789012:function:intercede-sweeper"
  }
}

override_resource {
  target = aws_iam_role.sweeper_scheduler
  values = {
    arn = "arn:aws:iam::123456789012:role/intercede-sweeper-scheduler"
  }
}

run "database_runs_postgres_18_next_to_the_api" {
  command = plan

  assert {
    condition     = neon_project.main.pg_version == 18
    error_message = "The Neon project must run Postgres 18, the major docker-compose.yml uses (ADR-0003)."
  }

  assert {
    condition     = neon_project.main.region_id == "aws-us-east-1"
    error_message = "The Neon project must sit in the API's region (ADR-0009)."
  }

  assert {
    condition     = one(neon_project.main.branch).name == "main" && one(neon_project.main.branch).role_name == "intercede" && one(neon_project.main.branch).database_name == "intercede"
    error_message = "The project must provision the main branch with the intercede role and database, as docker-compose.yml does locally."
  }
}

run "api_runs_on_node_24_arm64_without_secrets_from_terraform" {
  command = plan

  assert {
    condition     = aws_lambda_function.api.runtime == "nodejs24.x" && aws_lambda_function.api.architectures == tolist(["arm64"])
    error_message = "The API must run on nodejs24.x ARM64 (ADR-0002)."
  }

  assert {
    condition     = aws_lambda_function.api.handler == "api.handler"
    error_message = "The handler must match the bundle the build emits (dist/api.mjs)."
  }

  assert {
    condition     = length(aws_lambda_function.api.environment) == 0
    error_message = "Terraform must not set the API's environment; the deploy job injects secrets (ADR-0010)."
  }

  assert {
    condition     = aws_iam_role.api.permissions_boundary == "arn:aws:iam::123456789012:policy/github-actions-intercede-workload-boundary"
    error_message = "The API role must carry the workload boundary, or the apply role is denied."
  }

  assert {
    condition     = startswith(aws_iam_role.api.name, "intercede-")
    error_message = "IAM roles must be named intercede-* for the apply role to manage them."
  }

  assert {
    condition     = aws_cloudwatch_log_group.api.name == "/aws/lambda/intercede-api" && aws_cloudwatch_log_group.api.retention_in_days == 7
    error_message = "The API's log group must keep logs for 7 days."
  }
}

run "sweeper_runs_on_node_24_arm64_without_secrets_from_terraform" {
  command = plan

  assert {
    condition     = aws_lambda_function.sweeper.function_name == "intercede-sweeper" && aws_lambda_function.sweeper.runtime == "nodejs24.x" && aws_lambda_function.sweeper.architectures == tolist(["arm64"])
    error_message = "The sweeper must be its own function on nodejs24.x ARM64, apart from the API (ADR-0002)."
  }

  assert {
    condition     = aws_lambda_function.sweeper.handler == "sweeper.handler"
    error_message = "The handler must match the bundle the build emits (dist/sweeper.mjs)."
  }

  assert {
    condition     = length(aws_lambda_function.sweeper.environment) == 0
    error_message = "Terraform must not set the sweeper's environment; the deploy job injects secrets such as the Neon URL (ADR-0010)."
  }

  assert {
    condition     = aws_iam_role.sweeper.permissions_boundary == "arn:aws:iam::123456789012:policy/github-actions-intercede-workload-boundary" && startswith(aws_iam_role.sweeper.name, "intercede-")
    error_message = "The sweeper role must be named intercede-* and carry the workload boundary, or the apply role is denied."
  }

  assert {
    condition     = aws_cloudwatch_log_group.sweeper.name == "/aws/lambda/intercede-sweeper" && aws_cloudwatch_log_group.sweeper.retention_in_days == 7
    error_message = "The sweeper's log group must keep logs for 7 days."
  }
}

run "sweeper_may_embed_with_titan_v2_only" {
  command = apply

  assert {
    condition = jsondecode(aws_iam_role_policy.sweeper_bedrock.policy).Statement == [{
      Effect   = "Allow"
      Action   = "bedrock:InvokeModel"
      Resource = "arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v2:0"
    }]
    error_message = "The sweeper may call Titan Text Embeddings v2 on Bedrock and no other model (ADR-0004, ADR-0005)."
  }

  assert {
    condition     = aws_iam_role_policy.sweeper_bedrock.role == aws_iam_role.sweeper.id
    error_message = "The Bedrock policy must be on the sweeper's role."
  }
}

run "sweeper_runs_every_5_minutes_by_default" {
  command = apply

  assert {
    condition     = aws_scheduler_schedule.sweeper.schedule_expression == "rate(5 minutes)" && aws_scheduler_schedule.sweeper.state == "ENABLED"
    error_message = "The sweeper must run every 5 minutes unless the variable says otherwise (ADR-0005)."
  }

  assert {
    condition     = one(aws_scheduler_schedule.sweeper.target).arn == aws_lambda_function.sweeper.arn && one(aws_scheduler_schedule.sweeper.target).role_arn == aws_iam_role.sweeper_scheduler.arn
    error_message = "The schedule must invoke the sweeper through its own role."
  }

  assert {
    condition     = one(aws_scheduler_schedule.sweeper.flexible_time_window).mode == "OFF"
    error_message = "The schedule must fire on time, not within a flexible window."
  }

  assert {
    condition     = one(one(aws_scheduler_schedule.sweeper.target).retry_policy).maximum_retry_attempts == 0
    error_message = "A missed tick must not be retried; the next tick re-dispatches anything left over."
  }
}

run "scheduler_role_may_only_invoke_the_sweeper" {
  command = apply

  assert {
    condition     = aws_iam_role.sweeper_scheduler.permissions_boundary == "arn:aws:iam::123456789012:policy/github-actions-intercede-workload-boundary" && startswith(aws_iam_role.sweeper_scheduler.name, "intercede-")
    error_message = "The scheduler role must be named intercede-* and carry the workload boundary, or the apply role is denied."
  }

  assert {
    condition = alltrue([
      for statement in jsondecode(aws_iam_role.sweeper_scheduler.assume_role_policy).Statement :
      statement.Principal.Service == "scheduler.amazonaws.com" && statement.Condition.StringEquals["aws:SourceAccount"] == "123456789012"
    ])
    error_message = "Only EventBridge Scheduler in this account may assume the scheduler role."
  }

  assert {
    condition = jsondecode(aws_iam_role_policy.sweeper_scheduler_invoke.policy).Statement == [{
      Effect   = "Allow"
      Action   = "lambda:InvokeFunction"
      Resource = aws_lambda_function.sweeper.arn
    }]
    error_message = "The scheduler role may invoke the sweeper and nothing else."
  }
}

