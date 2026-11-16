locals {
  sweeper_function_name = "intercede-sweeper"
}

data "archive_file" "sweeper_placeholder" {
  type        = "zip"
  output_path = "${path.module}/.terraform/sweeper-placeholder.zip"

  source {
    filename = "sweeper.mjs"
    content  = "export const handler = async () => {};\n"
  }
}

resource "aws_cloudwatch_log_group" "sweeper" {
  name              = "/aws/lambda/${local.sweeper_function_name}"
  retention_in_days = 7
}

resource "aws_iam_role" "sweeper" {
  name                 = local.sweeper_function_name
  permissions_boundary = data.aws_iam_policy.workload_boundary.arn
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "sweeper_logs" {
  name = "logs"
  role = aws_iam_role.sweeper.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
      Resource = "${aws_cloudwatch_log_group.sweeper.arn}:*"
    }]
  })
}

resource "aws_iam_role_policy" "sweeper_bedrock" {
  name = "bedrock"
  role = aws_iam_role.sweeper.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "bedrock:InvokeModel"
      Resource = "arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v2:0"
    }]
  })
}

resource "aws_lambda_function" "sweeper" {
  function_name = local.sweeper_function_name
  role          = aws_iam_role.sweeper.arn
  runtime       = "nodejs24.x"
  architectures = ["arm64"]
  handler       = "sweeper.handler"
  memory_size   = 512
  timeout       = 60
  filename      = data.archive_file.sweeper_placeholder.output_path

  lifecycle {
    ignore_changes = [filename, environment]
  }

  depends_on = [aws_cloudwatch_log_group.sweeper, aws_iam_role_policy.sweeper_logs]
}

resource "aws_iam_role" "sweeper_scheduler" {
  name                 = "${local.sweeper_function_name}-scheduler"
  permissions_boundary = data.aws_iam_policy.workload_boundary.arn
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "scheduler.amazonaws.com" }
      Action    = "sts:AssumeRole"
      Condition = { StringEquals = { "aws:SourceAccount" = local.account_id } }
    }]
  })
}

resource "aws_iam_role_policy" "sweeper_scheduler_invoke" {
  name = "invoke-sweeper"
  role = aws_iam_role.sweeper_scheduler.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "lambda:InvokeFunction"
      Resource = aws_lambda_function.sweeper.arn
    }]
  })
}

resource "aws_scheduler_schedule" "sweeper" {
  name                = local.sweeper_function_name
  schedule_expression = var.sweeper_schedule_expression
  state               = "ENABLED"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_lambda_function.sweeper.arn
    role_arn = aws_iam_role.sweeper_scheduler.arn

    retry_policy {
      maximum_retry_attempts = 0
    }
  }
}
