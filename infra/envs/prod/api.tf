locals {
  api_function_name = "intercede-api"
}

data "archive_file" "api_placeholder" {
  type        = "zip"
  output_path = "${path.module}/.terraform/api-placeholder.zip"

  source {
    filename = "api.mjs"
    content  = "export const handler = async () => ({ statusCode: 503, body: \"Not deployed yet\" });\n"
  }
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/${local.api_function_name}"
  retention_in_days = 7
}

resource "aws_iam_role" "api" {
  name                 = local.api_function_name
  permissions_boundary = local.workload_boundary_arn
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "api_logs" {
  name = "logs"
  role = aws_iam_role.api.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
      Resource = "${aws_cloudwatch_log_group.api.arn}:*"
    }]
  })
}

resource "aws_lambda_function" "api" {
  function_name = local.api_function_name
  role          = aws_iam_role.api.arn
  runtime       = "nodejs24.x"
  architectures = ["arm64"]
  handler       = "api.handler"
  memory_size   = 512
  timeout       = 30
  filename      = data.archive_file.api_placeholder.output_path

  lifecycle {
    ignore_changes = [filename, environment]
  }

  depends_on = [aws_cloudwatch_log_group.api, aws_iam_role_policy.api_logs]
}

resource "aws_lambda_function_url" "api" {
  function_name      = aws_lambda_function.api.function_name
  authorization_type = "AWS_IAM"
  invoke_mode        = "RESPONSE_STREAM"
}

resource "aws_lambda_permission" "cloudfront_invoke_url" {
  statement_id           = "AllowCloudFrontInvokeFunctionUrl"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.api.function_name
  principal              = "cloudfront.amazonaws.com"
  source_arn             = aws_cloudfront_distribution.site.arn
  function_url_auth_type = "AWS_IAM"
}

resource "aws_lambda_permission" "cloudfront_invoke" {
  statement_id             = "AllowCloudFrontInvokeFunctionViaUrl"
  action                   = "lambda:InvokeFunction"
  function_name            = aws_lambda_function.api.function_name
  principal                = "cloudfront.amazonaws.com"
  source_arn               = aws_cloudfront_distribution.site.arn
  invoked_via_function_url = true
}
