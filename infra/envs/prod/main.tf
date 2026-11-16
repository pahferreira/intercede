locals {
  account_id  = data.aws_caller_identity.current.account_id
  domain_name = "intercede.pahferreira.dev"
  zone_name   = "pahferreira.dev"
}

data "aws_caller_identity" "current" {}

data "aws_iam_policy" "workload_boundary" {
  name = "github-actions-intercede-workload-boundary"
}
