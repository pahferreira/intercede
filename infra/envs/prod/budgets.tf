resource "aws_budgets_budget" "monthly" {
  name         = "intercede-monthly"
  budget_type  = "COST"
  time_unit    = "MONTHLY"
  limit_amount = tostring(max(var.budget_alert_thresholds...))
  limit_unit   = "USD"

  dynamic "notification" {
    for_each = toset(var.budget_alert_thresholds)

    content {
      notification_type          = "ACTUAL"
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value
      threshold_type             = "ABSOLUTE_VALUE"
      subscriber_email_addresses = [var.budget_alert_email]
    }
  }
}
