data "aws_route53_zone" "main" {
  name         = local.zone_name
  private_zone = false
}

resource "aws_acm_certificate" "site" {
  domain_name       = local.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

locals {
  certificate_validation = one(aws_acm_certificate.site.domain_validation_options)
}

resource "aws_route53_record" "certificate_validation" {
  zone_id         = data.aws_route53_zone.main.zone_id
  name            = local.certificate_validation.resource_record_name
  type            = local.certificate_validation.resource_record_type
  records         = [local.certificate_validation.resource_record_value]
  ttl             = 300
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "site" {
  certificate_arn         = aws_acm_certificate.site.arn
  validation_record_fqdns = [aws_route53_record.certificate_validation.fqdn]
}

resource "aws_route53_record" "site" {
  for_each = toset(["A", "AAAA"])

  zone_id = data.aws_route53_zone.main.zone_id
  name    = local.domain_name
  type    = each.key

  alias {
    name                   = aws_cloudfront_distribution.site.domain_name
    zone_id                = aws_cloudfront_distribution.site.hosted_zone_id
    evaluate_target_health = false
  }
}
