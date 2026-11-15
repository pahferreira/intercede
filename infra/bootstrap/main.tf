locals {
  repository          = "pahferreira/intercede"
  github_oidc_host    = "token.actions.githubusercontent.com"
  main_subject        = "repo:${local.repository}:ref:refs/heads/main"
  pull_request_sub    = "repo:${local.repository}:pull_request"
  managed_role_prefix = "intercede-"
}

data "aws_caller_identity" "current" {}

resource "aws_s3_bucket" "state" {
  bucket = "intercede-tfstate-${data.aws_caller_identity.current.account_id}"

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket = aws_s3_bucket.state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "state" {
  bucket = aws_s3_bucket.state.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "DenyInsecureTransport"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource  = [aws_s3_bucket.state.arn, "${aws_s3_bucket.state.arn}/*"]
      Condition = { Bool = { "aws:SecureTransport" = "false" } }
    }]
  })

  depends_on = [aws_s3_bucket_public_access_block.state]
}

resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://${local.github_oidc_host}"
  client_id_list = ["sts.amazonaws.com"]
}

resource "aws_iam_role" "plan" {
  name = "github-actions-intercede-plan"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "${local.github_oidc_host}:aud" = "sts.amazonaws.com"
          "${local.github_oidc_host}:sub" = [local.main_subject, local.pull_request_sub]
        }
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "plan_read_only" {
  role       = aws_iam_role.plan.name
  policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
}

resource "aws_iam_role_policy" "plan_state_lock" {
  name = "state-lock"
  role = aws_iam_role.plan.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:PutObject", "s3:DeleteObject"]
      Resource = "${aws_s3_bucket.state.arn}/*.tflock"
    }]
  })
}

resource "aws_iam_role" "apply" {
  name = "github-actions-intercede-apply"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "${local.github_oidc_host}:aud" = "sts.amazonaws.com"
          "${local.github_oidc_host}:sub" = local.main_subject
        }
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "apply_read_only" {
  role       = aws_iam_role.apply.name
  policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
}

resource "aws_iam_role_policy_attachment" "apply_power_user" {
  role       = aws_iam_role.apply.name
  policy_arn = "arn:aws:iam::aws:policy/PowerUserAccess"
}

resource "aws_iam_role_policy" "apply_scoped" {
  name = "scoped-iam-and-state-guard"
  role = aws_iam_role.apply.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ManageIntercedeRolesAndPolicies"
        Effect = "Allow"
        Action = "iam:*"
        Resource = [
          "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${local.managed_role_prefix}*",
          "arn:aws:iam::${data.aws_caller_identity.current.account_id}:policy/${local.managed_role_prefix}*",
        ]
      },
      {
        Sid    = "ProtectStateBucketConfiguration"
        Effect = "Deny"
        Action = [
          "s3:DeleteBucket",
          "s3:DeleteBucketPolicy",
          "s3:PutBucketPolicy",
          "s3:PutBucketVersioning",
          "s3:PutBucketPublicAccessBlock",
          "s3:PutEncryptionConfiguration",
          "s3:PutLifecycleConfiguration",
        ]
        Resource = aws_s3_bucket.state.arn
      },
    ]
  })
}
