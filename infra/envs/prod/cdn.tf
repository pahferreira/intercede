locals {
  api_origin_id            = "api"
  web_origin_id            = "web"
  posthog_origin_id        = "posthog"
  posthog_assets_origin_id = "posthog-assets"
  all_methods              = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
  posthog_host             = "us.i.posthog.com"
  posthog_assets_host      = "us-assets.i.posthog.com"
  api_origin_host          = split("/", aws_lambda_function_url.api.function_url)[2]
  custom_origins = {
    (local.api_origin_id) = {
      domain_name              = local.api_origin_host
      origin_access_control_id = aws_cloudfront_origin_access_control.api.id
    }
    (local.posthog_origin_id) = {
      domain_name              = local.posthog_host
      origin_access_control_id = null
    }
    (local.posthog_assets_origin_id) = {
      domain_name              = local.posthog_assets_host
      origin_access_control_id = null
    }
  }
}

resource "aws_cloudfront_function" "strip_ingest_prefix" {
  name    = "intercede-strip-ingest-prefix"
  runtime = "cloudfront-js-2.0"
  publish = true
  code    = <<-JS
    function handler(event) {
      var request = event.request;
      request.uri = request.uri.replace(/^\/ingest/, "") || "/";
      return request;
    }
  JS
}

resource "aws_cloudfront_function" "spa_routes" {
  name    = "intercede-spa-routes"
  runtime = "cloudfront-js-2.0"
  publish = true
  code    = <<-JS
    function handler(event) {
      var request = event.request;
      if (!/\.[^/]+$/.test(request.uri)) {
        request.uri = "/index.html";
      }
      return request;
    }
  JS
}

data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_origin_request_policy" "all_viewer_except_host_header" {
  name = "Managed-AllViewerExceptHostHeader"
}

resource "aws_cloudfront_origin_access_control" "api" {
  name                              = "intercede-api"
  origin_access_control_origin_type = "lambda"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "site" {
  enabled             = true
  is_ipv6_enabled     = true
  http_version        = "http2and3"
  price_class         = "PriceClass_All"
  default_root_object = "index.html"
  aliases             = [local.domain_name]

  origin {
    origin_id                = local.web_origin_id
    domain_name              = aws_s3_bucket.web.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.web.id
  }

  dynamic "origin" {
    for_each = local.custom_origins

    content {
      origin_id                = origin.key
      domain_name              = origin.value.domain_name
      origin_access_control_id = origin.value.origin_access_control_id

      custom_origin_config {
        http_port              = 80
        https_port             = 443
        origin_protocol_policy = "https-only"
        origin_ssl_protocols   = ["TLSv1.2"]
      }
    }
  }

  ordered_cache_behavior {
    path_pattern             = "/ingest/static/*"
    target_origin_id         = local.posthog_assets_origin_id
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host_header.id
    compress                 = true

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.strip_ingest_prefix.arn
    }
  }

  ordered_cache_behavior {
    path_pattern             = "/ingest/*"
    target_origin_id         = local.posthog_origin_id
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = local.all_methods
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host_header.id
    compress                 = true

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.strip_ingest_prefix.arn
    }
  }

  ordered_cache_behavior {
    path_pattern             = "/api/*"
    target_origin_id         = local.api_origin_id
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = local.all_methods
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host_header.id
    compress                 = true
  }

  default_cache_behavior {
    target_origin_id       = local.web_origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = data.aws_cloudfront_cache_policy.caching_optimized.id
    compress               = true

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.spa_routes.arn
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.site.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}
