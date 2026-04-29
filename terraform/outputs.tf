output "experimental_site_bucket" {
  description = "S3 bucket holding the experimental SPA bundle."
  value       = aws_s3_bucket.site.id
}

output "experimental_site_bucket_arn" {
  description = "ARN of the experimental site bucket (used to scope the deploy IAM role)."
  value       = aws_s3_bucket.site.arn
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID for the experimental site (use for create-invalidation)."
  value       = aws_cloudfront_distribution.site.id
}

output "cloudfront_distribution_arn" {
  description = "CloudFront distribution ARN (used to scope the deploy IAM role)."
  value       = aws_cloudfront_distribution.site.arn
}

output "site_url" {
  description = "Primary HTTPS URL for the experimental app."
  value       = var.enable_custom_domain ? "https://${var.domain_name}" : "https://${aws_cloudfront_distribution.site.domain_name}"
}

output "cognito_user_pool_id" {
  description = "Cognito user pool ID (VITE_COGNITO_USER_POOL_ID)."
  value       = aws_cognito_user_pool.main.id
}

output "cognito_user_pool_client_id" {
  description = "Cognito user pool app client ID (VITE_COGNITO_CLIENT_ID)."
  value       = aws_cognito_user_pool_client.spa.id
}

output "cognito_domain" {
  description = "Cognito Hosted UI domain (VITE_COGNITO_DOMAIN), e.g. https://prefix.auth.region.amazoncognito.com"
  value       = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${var.aws_region}.amazoncognito.com"
}

output "api_invoke_url" {
  description = "Direct invoke URL for the API (debugging only — production traffic goes through CloudFront /api/*)."
  value       = aws_apigatewayv2_api.api.api_endpoint
}

output "workloads_table_name" {
  description = "DynamoDB table holding workloads."
  value       = aws_dynamodb_table.workloads.name
}

output "lambda_function_names" {
  description = "Names of the deployed Lambda functions (for the deploy workflow's update-function-code calls)."
  value       = { for k, fn in aws_lambda_function.fn : k => fn.function_name }
}
