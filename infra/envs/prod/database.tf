resource "neon_project" "main" {
  name                      = "intercede"
  region_id                 = "aws-us-east-1"
  pg_version                = 18
  history_retention_seconds = 21600

  branch {
    name          = "main"
    role_name     = "intercede"
    database_name = "intercede"
  }

  lifecycle {
    prevent_destroy = true
  }
}
