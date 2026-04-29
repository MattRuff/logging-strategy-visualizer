variable "project_name" {
  type        = string
  description = "Short name prefix for resources (lowercase letters, numbers, hyphens)."
  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project_name)) && length(var.project_name) <= 32
    error_message = "project_name must be lowercase alphanumeric plus hyphens, max 32 characters."
  }
}

variable "aws_region" {
  type        = string
  description = "AWS region for the S3 bucket and primary provider."
  default     = "us-east-1"
}

variable "enable_bucket_versioning" {
  type        = bool
  description = "Enable S3 versioning on the site bucket."
  default     = true
}

variable "enable_custom_domain" {
  type        = bool
  description = "If true, request an ACM certificate (us-east-1) and create Route 53 alias records."
  default     = false
}

variable "domain_name" {
  type        = string
  description = "Fully qualified domain name for the site (e.g. app.example.com). Required when enable_custom_domain is true."
  default     = ""
}

variable "hosted_zone_id" {
  type        = string
  description = "Route 53 hosted zone ID for DNS validation and alias records. Required when enable_custom_domain is true."
  default     = ""
}

variable "price_class" {
  type        = string
  description = "CloudFront price class: PriceClass_All, PriceClass_200, or PriceClass_100."
  default     = "PriceClass_100"
  validation {
    condition = contains([
      "PriceClass_All",
      "PriceClass_200",
      "PriceClass_100",
    ], var.price_class)
    error_message = "price_class must be PriceClass_All, PriceClass_200, or PriceClass_100."
  }
}
