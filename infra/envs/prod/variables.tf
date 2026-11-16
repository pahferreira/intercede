variable "sweeper_schedule_expression" {
  description = "How often EventBridge Scheduler runs the sweeper, as a rate() or cron() expression."
  type        = string
  default     = "rate(5 minutes)"

  validation {
    condition     = can(regex("^(rate|cron)\\(.+\\)$", var.sweeper_schedule_expression))
    error_message = "sweeper_schedule_expression must be a rate() or cron() expression."
  }
}
