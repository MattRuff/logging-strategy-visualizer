variable "project_name" {
  type        = string
  description = "Short name prefix. Should differ from the stable stack to avoid resource name collisions."
  default     = "logging-strategy-experimental"
  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project_name)) && length(var.project_name) <= 40
    error_message = "project_name must be lowercase alphanumeric plus hyphens, max 40 characters."
  }
}

variable "aws_region" {
  type        = string
  description = "Region for DynamoDB, Lambda, API Gateway, and the S3 site bucket."
  default     = "us-east-1"
}

variable "cognito_domain_prefix" {
  type        = string
  description = "Prefix for the Cognito Hosted UI domain (must be globally unique within the region)."
  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.cognito_domain_prefix)) && length(var.cognito_domain_prefix) >= 3 && length(var.cognito_domain_prefix) <= 63
    error_message = "cognito_domain_prefix must be 3-63 chars, lowercase alphanumeric plus hyphens."
  }
}

variable "google_oauth_secret_arn" {
  type        = string
  description = "ARN of an AWS Secrets Manager secret holding {\"client_id\":\"...\",\"client_secret\":\"...\"} for the Google OAuth web client."
}

variable "enable_custom_domain" {
  type        = bool
  description = "If true, request an ACM cert (us-east-1) and create a Route 53 alias for the experimental site."
  default     = false
}

variable "domain_name" {
  type        = string
  description = "FQDN for the experimental site (e.g. experimental.example.com). Required when enable_custom_domain is true."
  default     = ""
}

variable "hosted_zone_id" {
  type        = string
  description = "Route 53 hosted zone ID for DNS validation and alias records. Required when enable_custom_domain is true."
  default     = ""
}

variable "price_class" {
  type        = string
  description = "CloudFront price class."
  default     = "PriceClass_100"
  validation {
    condition     = contains(["PriceClass_All", "PriceClass_200", "PriceClass_100"], var.price_class)
    error_message = "price_class must be PriceClass_All, PriceClass_200, or PriceClass_100."
  }
}

variable "lambda_log_retention_days" {
  type        = number
  description = "CloudWatch Logs retention for Lambda log groups."
  default     = 14
}
