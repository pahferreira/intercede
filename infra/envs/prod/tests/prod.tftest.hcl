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
