output "state_bucket_name" {
  value = aws_s3_bucket.state.bucket
}

output "plan_role_arn" {
  value = aws_iam_role.plan.arn
}

output "apply_role_arn" {
  value = aws_iam_role.apply.arn
}

output "workload_permissions_boundary_arn" {
  value = aws_iam_policy.workload_boundary.arn
}
