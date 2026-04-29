output "s3_bucket_id" {
  description = "Name of the S3 bucket holding static assets."
  value       = aws_s3_bucket.site.id
}

output "s3_bucket_arn" {
  description = "ARN of the site bucket (for IAM policy scoping)."
  value       = aws_s3_bucket.site.arn
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID (for create-invalidation in CI)."
  value       = aws_cloudfront_distribution.site.id
}

output "cloudfront_domain_name" {
  description = "CloudFront hostname (*.cloudfront.net)."
  value       = aws_cloudfront_distribution.site.domain_name
}

output "site_url" {
  description = "Primary HTTPS URL for the app."
  value       = var.enable_custom_domain ? "https://${var.domain_name}" : "https://${aws_cloudfront_distribution.site.domain_name}"
}

output "deploy_cli_hint" {
  description = "Example AWS CLI commands after build (replace paths as needed)."
  value       = <<-EOT
    aws s3 sync dist/ s3://${aws_s3_bucket.site.id}/ --delete
    aws cloudfront create-invalidation --distribution-id ${aws_cloudfront_distribution.site.id} --paths "/*"
  EOT
}
