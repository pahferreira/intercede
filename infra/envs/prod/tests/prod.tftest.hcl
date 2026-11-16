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

variables {
  budget_alert_email = "alerts@example.com"
}

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

run "budget_emails_at_the_adr_0012_thresholds_by_default" {
  command = plan

  assert {
    condition     = aws_budgets_budget.monthly.budget_type == "COST" && aws_budgets_budget.monthly.time_unit == "MONTHLY"
    error_message = "The budget must track the account's monthly cost."
  }

  assert {
    condition     = aws_budgets_budget.monthly.limit_amount == "10" && aws_budgets_budget.monthly.limit_unit == "USD"
    error_message = "The budget's limit must be the highest alert threshold, $10."
  }

  assert {
    condition = toset([
      for n in aws_budgets_budget.monthly.notification :
      n.threshold if n.threshold_type == "ABSOLUTE_VALUE" && n.notification_type == "ACTUAL" && n.comparison_operator == "GREATER_THAN" && n.subscriber_email_addresses == toset(["alerts@example.com"])
    ]) == toset([1, 5, 10])
    error_message = "Actual spend above $1, $5 and $10 must email the alert address (ADR-0012)."
  }
}

run "budget_thresholds_and_email_come_from_variables" {
  command = plan

  variables {
    budget_alert_thresholds = [2, 20]
    budget_alert_email      = "ops@example.com"
  }

  assert {
    condition     = aws_budgets_budget.monthly.limit_amount == "20"
    error_message = "The budget's limit must follow the highest threshold."
  }

  assert {
    condition = toset([
      for n in aws_budgets_budget.monthly.notification :
      n.threshold if n.subscriber_email_addresses == toset(["ops@example.com"])
    ]) == toset([2, 20])
    error_message = "The alerts must follow budget_alert_thresholds and budget_alert_email."
  }
}

run "budget_email_stays_out_of_public_plan_output" {
  command = plan

  assert {
    condition     = issensitive(var.budget_alert_email)
    error_message = "budget_alert_email must be sensitive, since CI posts the plan on a public pull request."
  }
}

run "lambdas_reserve_no_concurrency_by_default" {
  command = plan

  assert {
    condition     = aws_lambda_function.api.reserved_concurrent_executions == null && aws_lambda_function.sweeper.reserved_concurrent_executions == null
    error_message = "Without a reservation set, both Lambdas must stay unreserved so apply works on an account limit of 10."
  }
}

run "sweeper_concurrency_is_capped_from_a_variable" {
  command = plan

  variables {
    sweeper_reserved_concurrency = 1
  }

  assert {
    condition     = aws_lambda_function.sweeper.reserved_concurrent_executions == 1
    error_message = "The sweeper's reserved concurrency must come from sweeper_reserved_concurrency (ADR-0012)."
  }
}

run "sweeper_concurrency_of_zero_is_rejected" {
  command = plan

  variables {
    sweeper_reserved_concurrency = 0
  }

  expect_failures = [var.sweeper_reserved_concurrency]
}

run "api_concurrency_is_capped_from_a_variable" {
  command = plan

  variables {
    api_reserved_concurrency = 3
  }

  assert {
    condition     = aws_lambda_function.api.reserved_concurrent_executions == 3
    error_message = "The API's reserved concurrency must come from api_reserved_concurrency (ADR-0012)."
  }
}

run "api_concurrency_of_zero_is_rejected" {
  command = plan

  variables {
    api_reserved_concurrency = 0
  }

  expect_failures = [var.api_reserved_concurrency]
}

run "budget_without_thresholds_is_rejected" {
  command = plan

  variables {
    budget_alert_thresholds = []
  }

  expect_failures = [var.budget_alert_thresholds]
}

run "budget_with_a_non_positive_threshold_is_rejected" {
  command = plan

  variables {
    budget_alert_thresholds = [0, 5]
  }

  expect_failures = [var.budget_alert_thresholds]
}

run "budget_with_more_than_five_thresholds_is_rejected" {
  command = plan

  variables {
    budget_alert_thresholds = [1, 2, 3, 4, 5, 6]
  }

  expect_failures = [var.budget_alert_thresholds]
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

run "sweeper_frequency_comes_from_a_variable" {
  command = plan

  variables {
    sweeper_schedule_expression = "rate(1 minute)"
  }

  assert {
    condition     = aws_scheduler_schedule.sweeper.schedule_expression == "rate(1 minute)"
    error_message = "The schedule must follow sweeper_schedule_expression."
  }
}

run "sweeper_frequency_must_be_a_schedule_expression" {
  command = plan

  variables {
    sweeper_schedule_expression = "5 minutes"
  }

  expect_failures = [var.sweeper_schedule_expression]
}

run "api_is_reachable_only_through_cloudfront_without_caching" {
  command = apply

  assert {
    condition     = aws_lambda_function_url.api.authorization_type == "AWS_IAM" && aws_lambda_function_url.api.invoke_mode == "RESPONSE_STREAM"
    error_message = "The Function URL must require IAM (signed by CloudFront) and stream responses."
  }

  assert {
    condition = anytrue([
      for origin in aws_cloudfront_distribution.site.origin :
      origin.domain_name == "abc123.lambda-url.us-east-1.on.aws"
      && origin.origin_access_control_id == aws_cloudfront_origin_access_control.api.id
      && origin.origin_id == one([for b in aws_cloudfront_distribution.site.ordered_cache_behavior : b.target_origin_id if b.path_pattern == "/api/*"])
    ])
    error_message = "/api/* must reach the Function URL through origin access control."
  }

  assert {
    condition     = aws_cloudfront_origin_access_control.api.origin_access_control_origin_type == "lambda" && aws_cloudfront_origin_access_control.api.signing_behavior == "always"
    error_message = "The API origin access control must sign every request for Lambda."
  }

  assert {
    condition     = one([for b in aws_cloudfront_distribution.site.ordered_cache_behavior : b.cache_policy_id if b.path_pattern == "/api/*"]) == data.aws_cloudfront_cache_policy.caching_disabled.id
    error_message = "/api/* must not be cached."
  }

  assert {
    condition     = data.aws_cloudfront_cache_policy.caching_disabled.name == "Managed-CachingDisabled"
    error_message = "The no-cache policy must be the managed CachingDisabled policy."
  }

  assert {
    condition = alltrue([
      for permission in [aws_lambda_permission.cloudfront_invoke_url, aws_lambda_permission.cloudfront_invoke] :
      permission.principal == "cloudfront.amazonaws.com" && permission.source_arn == aws_cloudfront_distribution.site.arn
    ])
    error_message = "Only this distribution may invoke the API."
  }
}

run "default_serves_the_spa_from_a_private_bucket" {
  command = apply

  assert {
    condition = anytrue([
      for origin in aws_cloudfront_distribution.site.origin :
      origin.origin_id == aws_cloudfront_distribution.site.default_cache_behavior[0].target_origin_id
      && origin.domain_name == aws_s3_bucket.web.bucket_regional_domain_name
      && origin.origin_access_control_id == aws_cloudfront_origin_access_control.web.id
    ])
    error_message = "The default behaviour must serve the web bucket through origin access control."
  }

  assert {
    condition     = aws_cloudfront_origin_access_control.web.origin_access_control_origin_type == "s3"
    error_message = "The web origin access control must be for S3."
  }

  assert {
    condition = alltrue([
      aws_s3_bucket_public_access_block.web.block_public_acls,
      aws_s3_bucket_public_access_block.web.block_public_policy,
      aws_s3_bucket_public_access_block.web.ignore_public_acls,
      aws_s3_bucket_public_access_block.web.restrict_public_buckets,
    ])
    error_message = "The web bucket must block all public access."
  }

  assert {
    condition = anytrue([
      for statement in jsondecode(aws_s3_bucket_policy.web.policy).Statement :
      statement.Effect == "Allow"
      && statement.Principal.Service == "cloudfront.amazonaws.com"
      && statement.Action == "s3:GetObject"
      && statement.Condition.StringEquals["AWS:SourceArn"] == aws_cloudfront_distribution.site.arn
    ])
    error_message = "Only this distribution may read the web bucket."
  }

  assert {
    condition     = aws_cloudfront_distribution.site.default_root_object == "index.html"
    error_message = "The root must serve the SPA's index.html."
  }

  assert {
    condition     = one(aws_cloudfront_distribution.site.default_cache_behavior[0].function_association).function_arn == aws_cloudfront_function.spa_routes.arn && one(aws_cloudfront_distribution.site.default_cache_behavior[0].function_association).event_type == "viewer-request"
    error_message = "Deep links such as /pray must be served the SPA's index.html."
  }
}

run "ingest_proxies_to_posthog_without_the_prefix" {
  command = apply

  assert {
    condition = alltrue([
      for pair in [["/ingest/static/*", "us-assets.i.posthog.com"], ["/ingest/*", "us.i.posthog.com"]] :
      anytrue([
        for origin in aws_cloudfront_distribution.site.origin :
        origin.domain_name == pair[1]
        && origin.origin_id == one([for b in aws_cloudfront_distribution.site.ordered_cache_behavior : b.target_origin_id if b.path_pattern == pair[0]])
      ])
    ])
    error_message = "/ingest/static/* must reach PostHog's assets host and /ingest/* its ingestion host."
  }

  assert {
    condition     = index([for b in aws_cloudfront_distribution.site.ordered_cache_behavior : b.path_pattern], "/ingest/static/*") < index([for b in aws_cloudfront_distribution.site.ordered_cache_behavior : b.path_pattern], "/ingest/*")
    error_message = "/ingest/static/* must be matched before /ingest/*."
  }

  assert {
    condition = alltrue([
      for b in aws_cloudfront_distribution.site.ordered_cache_behavior :
      b.cache_policy_id == data.aws_cloudfront_cache_policy.caching_disabled.id
      && one(b.function_association).event_type == "viewer-request"
      && one(b.function_association).function_arn == aws_cloudfront_function.strip_ingest_prefix.arn
      if startswith(b.path_pattern, "/ingest/")
    ])
    error_message = "PostHog traffic must not be cached and must reach PostHog without the /ingest prefix."
  }
}

run "site_answers_on_its_custom_domain_with_a_us_east_1_certificate" {
  command = apply

  assert {
    condition     = data.aws_route53_zone.main.name == "pahferreira.dev" && data.aws_route53_zone.main.private_zone == false
    error_message = "The record must go in the existing public pahferreira.dev zone, looked up rather than owned."
  }

  assert {
    condition     = aws_acm_certificate.site.domain_name == "intercede.pahferreira.dev" && aws_acm_certificate.site.validation_method == "DNS"
    error_message = "The certificate must cover the site and validate through DNS."
  }

  assert {
    condition     = aws_route53_record.certificate_validation.zone_id == "Z0123456789EXAMPLE" && aws_route53_record.certificate_validation.name == "_abc.intercede.pahferreira.dev." && aws_route53_record.certificate_validation.records == toset(["_xyz.acm-validations.aws."])
    error_message = "The certificate's validation record must be written in the zone."
  }

  assert {
    condition     = aws_acm_certificate_validation.site.certificate_arn == aws_acm_certificate.site.arn
    error_message = "Terraform must wait for the certificate to validate."
  }

  assert {
    condition     = aws_cloudfront_distribution.site.aliases == toset(["intercede.pahferreira.dev"])
    error_message = "The distribution must answer on intercede.pahferreira.dev."
  }

  assert {
    condition     = one(aws_cloudfront_distribution.site.viewer_certificate).acm_certificate_arn == aws_acm_certificate_validation.site.certificate_arn && one(aws_cloudfront_distribution.site.viewer_certificate).ssl_support_method == "sni-only"
    error_message = "The distribution must serve the validated certificate over SNI."
  }

  assert {
    condition = alltrue([
      for type, record in aws_route53_record.site :
      record.zone_id == "Z0123456789EXAMPLE"
      && record.name == "intercede.pahferreira.dev"
      && one(record.alias).name == aws_cloudfront_distribution.site.domain_name
      && one(record.alias).zone_id == aws_cloudfront_distribution.site.hosted_zone_id
      && record.type == type
    ]) && toset(keys(aws_route53_record.site)) == toset(["A", "AAAA"])
    error_message = "intercede.pahferreira.dev must alias the distribution over IPv4 and IPv6."
  }
}
