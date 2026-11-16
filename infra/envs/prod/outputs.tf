output "api_function_name" {
  value = aws_lambda_function.api.function_name
}

output "sweeper_function_name" {
  value = aws_lambda_function.sweeper.function_name
}

output "web_bucket_name" {
  value = aws_s3_bucket.web.bucket
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.site.id
}
