locals {
  account_id            = data.aws_caller_identity.current.account_id
  domain_name           = "intercede.pahferreira.dev"
  zone_name             = "pahferreira.dev"
  workload_boundary_arn = "arn:aws:iam::${local.account_id}:policy/github-actions-intercede-workload-boundary"
}

data "aws_caller_identity" "current" {}
