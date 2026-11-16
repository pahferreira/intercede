variable "sweeper_schedule_expression" {
  description = "How often EventBridge Scheduler runs the sweeper, as a rate() or cron() expression."
  type        = string
  default     = "rate(5 minutes)"

  validation {
    condition     = can(regex("^(rate|cron)\\(.+\\)$", var.sweeper_schedule_expression))
    error_message = "sweeper_schedule_expression must be a rate() or cron() expression."
  }
}

variable "budget_alert_email" {
  description = "Address AWS Budgets emails when monthly spend crosses a threshold."
  type        = string
  sensitive   = true
}

variable "budget_alert_thresholds" {
  description = "Monthly spend, in USD, at which AWS Budgets emails budget_alert_email (ADR-0012). The highest is the budget's limit."
  type        = list(number)
  default     = [1, 5, 10]

  validation {
    condition     = length(var.budget_alert_thresholds) > 0 && length(var.budget_alert_thresholds) <= 5 && alltrue([for t in var.budget_alert_thresholds : t > 0])
    error_message = "budget_alert_thresholds must hold between one and five positive amounts; AWS Budgets allows at most five notifications per budget."
  }
}

variable "api_reserved_concurrency" {
  description = "Concurrent executions reserved for, and capping, the API Lambda (ADR-0012). Null leaves it unreserved."
  type        = number
  default     = null

  validation {
    condition     = var.api_reserved_concurrency == null ? true : var.api_reserved_concurrency >= 1 && floor(var.api_reserved_concurrency) == var.api_reserved_concurrency
    error_message = "api_reserved_concurrency must be null or a whole number of at least 1; 0 would stop the API."
  }
}

variable "sweeper_reserved_concurrency" {
  description = "Concurrent executions reserved for, and capping, the sweeper Lambda (ADR-0012). Null leaves it unreserved."
  type        = number
  default     = null

  validation {
    condition     = var.sweeper_reserved_concurrency == null ? true : var.sweeper_reserved_concurrency >= 1 && floor(var.sweeper_reserved_concurrency) == var.sweeper_reserved_concurrency
    error_message = "sweeper_reserved_concurrency must be null or a whole number of at least 1; 0 would stop the sweeper."
  }
}
