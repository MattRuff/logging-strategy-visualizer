locals {
  site_origin_id = "s3-${var.project_name}"
  api_origin_id  = "apigw-${var.project_name}"

  # Five Lambdas, all sharing one zip; each function points at its own subdir's handler.
  lambda_functions = {
    saveWorkload    = { handler = "saveWorkload/index.handler", method = "PUT", route = "/api/workloads/{id}" }
    loadWorkload    = { handler = "loadWorkload/index.handler", method = "GET", route = "/api/workloads/{id}" }
    listMyWorkloads = { handler = "listMyWorkloads/index.handler", method = "GET", route = "/api/workloads" }
    publish         = { handler = "publish/index.handler", method = "POST", route = "/api/workloads/{id}/publish" }
    listArchive     = { handler = "listArchive/index.handler", method = "GET", route = "/api/archive" }
  }
}

check "custom_domain_inputs" {
  assert {
    condition     = !var.enable_custom_domain || (var.domain_name != "" && var.hosted_zone_id != "")
    error_message = "When enable_custom_domain is true, set domain_name and hosted_zone_id."
  }
}

resource "random_id" "suffix" {
  byte_length = 4
}

# -------------------------------------------------------------------
# DynamoDB — workloads table (per-user + archive partitions)
# -------------------------------------------------------------------

resource "aws_dynamodb_table" "workloads" {
  name         = "${var.project_name}-workloads"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }
  attribute {
    name = "sk"
    type = "S"
  }
  attribute {
    name = "updatedAt"
    type = "S"
  }

  global_secondary_index {
    name            = "byUpdatedAt"
    hash_key        = "pk"
    range_key       = "updatedAt"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }
}

# -------------------------------------------------------------------
# Cognito — user pool with email + password (Hosted UI handles signup/signin)
# -------------------------------------------------------------------

resource "aws_cognito_user_pool" "main" {
  name = "${var.project_name}-users"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true
  }

  password_policy {
    minimum_length    = 8
    require_lowercase = false
    require_numbers   = false
    require_symbols   = false
    require_uppercase = false
  }
}

resource "aws_cognito_user_pool_domain" "main" {
  domain       = var.cognito_domain_prefix
  user_pool_id = aws_cognito_user_pool.main.id
}

resource "aws_cognito_user_pool_client" "spa" {
  name         = "${var.project_name}-spa"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret               = false
  prevent_user_existence_errors = "ENABLED"

  allowed_oauth_flows                  = ["code"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes                 = ["openid", "email", "profile"]

  supported_identity_providers = ["COGNITO"]

  # CloudFront distribution domain isn't known at this point (cycle: cognito_client →
  # cloudfront → api → cognito_authorizer → cognito_client). We seed with localhost
  # and any custom domain, then null_resource.cognito_callback_url_patch below
  # appends the CloudFront URL after the distribution exists.
  callback_urls = compact([
    var.enable_custom_domain ? "https://${var.domain_name}/auth/callback" : null,
    "http://localhost:5173/auth/callback",
  ])
  logout_urls = compact([
    var.enable_custom_domain ? "https://${var.domain_name}/" : null,
    "http://localhost:5173/",
  ])

  lifecycle {
    ignore_changes = [callback_urls, logout_urls]
  }

  explicit_auth_flows = [
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH",
  ]

  access_token_validity  = 60 # minutes
  id_token_validity      = 60 # minutes
  refresh_token_validity = 30 # days
  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
}

# -------------------------------------------------------------------
# Lambda — five functions sharing one role + one zip per function
# -------------------------------------------------------------------

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  name               = "${var.project_name}-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "lambda_ddb" {
  statement {
    sid    = "WorkloadsTableAccess"
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:Query",
    ]
    resources = [
      aws_dynamodb_table.workloads.arn,
      "${aws_dynamodb_table.workloads.arn}/index/*",
    ]
  }
}

resource "aws_iam_role_policy" "lambda_ddb" {
  name   = "${var.project_name}-ddb"
  role   = aws_iam_role.lambda.id
  policy = data.aws_iam_policy_document.lambda_ddb.json
}

# -------------------------------------------------------------------
# Datadog API key — stored in Secrets Manager so it's never in env vars
# or committed to source. The Datadog Lambda Extension reads it via
# DD_API_KEY_SECRET_ARN at cold start.
# -------------------------------------------------------------------

resource "aws_secretsmanager_secret" "datadog_api_key" {
  name                    = "${var.project_name}/datadog-api-key"
  description             = "Datadog API key for the Lambda Extension."
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "datadog_api_key" {
  secret_id     = aws_secretsmanager_secret.datadog_api_key.id
  secret_string = var.datadog_api_key
}

data "aws_iam_policy_document" "lambda_dd_secret" {
  statement {
    sid       = "ReadDatadogApiKey"
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.datadog_api_key.arn]
  }
}

resource "aws_iam_role_policy" "lambda_dd_secret" {
  name   = "${var.project_name}-dd-secret"
  role   = aws_iam_role.lambda.id
  policy = data.aws_iam_policy_document.lambda_dd_secret.json
}

# All five Lambdas ship as one zip containing every handler subdirectory plus shared/.
# Each aws_lambda_function points at its own subdir's handler (e.g. "saveWorkload/index.handler").
# Plain ESM, no build step — AWS SDK v3 ships in the Node 22 runtime, and the API Gateway
# JWT authorizer pre-validates tokens so handlers only need to read claims from the event.
data "archive_file" "lambda_bundle" {
  type        = "zip"
  source_dir  = "${path.module}/../lambda"
  output_path = "${path.module}/.build/lambda_bundle.zip"
  excludes    = [".build", "package-lock.json"]
}

resource "aws_cloudwatch_log_group" "lambda" {
  for_each          = local.lambda_functions
  name              = "/aws/lambda/${var.project_name}-${each.key}"
  retention_in_days = var.lambda_log_retention_days
}

resource "aws_lambda_function" "fn" {
  for_each = local.lambda_functions

  function_name = "${var.project_name}-${each.key}"
  role          = aws_iam_role.lambda.arn

  # Datadog Lambda Extension wraps the handler. The real handler path is passed
  # to the wrapper via DD_LAMBDA_HANDLER below.
  handler          = "/opt/nodejs/node_modules/datadog-lambda-js/handler.handler"
  runtime          = "nodejs22.x"
  filename         = data.archive_file.lambda_bundle.output_path
  source_code_hash = data.archive_file.lambda_bundle.output_base64sha256
  timeout          = 10
  memory_size      = 256

  layers = [
    var.datadog_extension_layer_arn,
    var.datadog_node_layer_arn,
  ]

  environment {
    variables = {
      WORKLOADS_TABLE            = aws_dynamodb_table.workloads.name
      COGNITO_ISSUER             = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.main.id}"
      DD_LAMBDA_HANDLER          = each.value.handler
      DD_API_KEY_SECRET_ARN      = aws_secretsmanager_secret.datadog_api_key.arn
      DD_SITE                    = var.datadog_site
      DD_SERVICE                 = "logging-workflow"
      DD_ENV                     = var.datadog_env
      DD_TRACE_ENABLED           = "true"
      DD_SERVERLESS_LOGS_ENABLED = "true"
      DD_MERGE_XRAY_TRACES       = "true"
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.lambda,
    aws_secretsmanager_secret_version.datadog_api_key,
    aws_iam_role_policy.lambda_dd_secret,
  ]

  # The deploy workflow merges per-commit Datadog source-code env vars
  # (DD_GIT_COMMIT_SHA, DD_GIT_REPOSITORY_URL, DD_VERSION) into the function
  # config on every push. Ignore the environment block so Terraform does not
  # fight that workflow on the next plan.
  lifecycle {
    ignore_changes = [environment]
  }
}

# -------------------------------------------------------------------
# API Gateway HTTP API + JWT authorizer + routes
# -------------------------------------------------------------------

resource "aws_apigatewayv2_api" "api" {
  name          = "${var.project_name}-api"
  protocol_type = "HTTP"

  # CORS only matters for direct API Gateway invocation (dev / debug). Production
  # traffic flows same-origin through CloudFront /api/*, so no preflight. Wildcard
  # is safe because every route is JWT-authorized.
  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["authorization", "content-type"]
    max_age       = 300
  }
}

resource "aws_apigatewayv2_authorizer" "jwt" {
  api_id           = aws_apigatewayv2_api.api.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "cognito-jwt"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.spa.id]
    issuer   = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.main.id}"
  }
}

resource "aws_apigatewayv2_integration" "fn" {
  for_each = local.lambda_functions

  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.fn[each.key].invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "fn" {
  for_each = local.lambda_functions

  api_id             = aws_apigatewayv2_api.api.id
  route_key          = "${each.value.method} ${each.value.route}"
  target             = "integrations/${aws_apigatewayv2_integration.fn[each.key].id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

resource "aws_lambda_permission" "apigw" {
  for_each = local.lambda_functions

  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.fn[each.key].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true
}

# -------------------------------------------------------------------
# S3 — experimental site bucket (separate from stable bucket)
# -------------------------------------------------------------------

resource "aws_s3_bucket" "site" {
  bucket = "${var.project_name}-site-${random_id.suffix.hex}"
}

resource "aws_s3_bucket_public_access_block" "site" {
  bucket                  = aws_s3_bucket.site.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "site" {
  bucket = aws_s3_bucket.site.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_versioning" "site" {
  bucket = aws_s3_bucket.site.id
  versioning_configuration {
    status = "Enabled"
  }
}

# -------------------------------------------------------------------
# CloudFront — separate distribution, two origins (S3 default, /api/* → API GW)
# -------------------------------------------------------------------

data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_origin_request_policy" "all_viewer_except_host" {
  name = "Managed-AllViewerExceptHostHeader"
}

resource "aws_cloudfront_origin_access_control" "site" {
  name                              = "${var.project_name}-oac"
  description                       = "OAC for ${var.project_name} site bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_acm_certificate" "site" {
  count             = var.enable_custom_domain ? 1 : 0
  provider          = aws.us_east_1
  domain_name       = var.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "cert_validation" {
  for_each = var.enable_custom_domain ? {
    for dvo in aws_acm_certificate.site[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = var.hosted_zone_id
}

resource "aws_acm_certificate_validation" "site" {
  count                   = var.enable_custom_domain ? 1 : 0
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.site[0].arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation : r.fqdn]
}

resource "aws_cloudfront_distribution" "site" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.project_name} experimental site"
  default_root_object = "index.html"
  price_class         = var.price_class
  aliases             = var.enable_custom_domain ? [var.domain_name] : []

  origin {
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_id                = local.site_origin_id
    origin_access_control_id = aws_cloudfront_origin_access_control.site.id
  }

  origin {
    domain_name = replace(aws_apigatewayv2_api.api.api_endpoint, "https://", "")
    origin_id   = local.api_origin_id

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = local.site_origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = data.aws_cloudfront_cache_policy.caching_optimized.id
  }

  ordered_cache_behavior {
    path_pattern             = "/api/*"
    target_origin_id         = local.api_origin_id
    viewer_protocol_policy   = "https-only"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    compress                 = true
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id
  }

  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  dynamic "viewer_certificate" {
    for_each = var.enable_custom_domain ? [1] : []
    content {
      acm_certificate_arn      = aws_acm_certificate_validation.site[0].certificate_arn
      ssl_support_method       = "sni-only"
      minimum_protocol_version = "TLSv1.2_2021"
    }
  }

  dynamic "viewer_certificate" {
    for_each = var.enable_custom_domain ? [] : [1]
    content {
      cloudfront_default_certificate = true
    }
  }
}

data "aws_iam_policy_document" "site_bucket" {
  statement {
    sid       = "AllowCloudFrontRead"
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.site.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceArn"
      values   = [aws_cloudfront_distribution.site.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id
  policy = data.aws_iam_policy_document.site_bucket.json
}

resource "aws_route53_record" "site_a" {
  count   = var.enable_custom_domain ? 1 : 0
  zone_id = var.hosted_zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.site.domain_name
    zone_id                = aws_cloudfront_distribution.site.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "site_aaaa" {
  count   = var.enable_custom_domain ? 1 : 0
  zone_id = var.hosted_zone_id
  name    = var.domain_name
  type    = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.site.domain_name
    zone_id                = aws_cloudfront_distribution.site.hosted_zone_id
    evaluate_target_health = false
  }
}

# -------------------------------------------------------------------
# Cognito callback patch — add the CloudFront URL after the distribution exists.
# (See cycle note on aws_cognito_user_pool_client.spa.)
# -------------------------------------------------------------------

locals {
  cognito_callback_urls = compact([
    var.enable_custom_domain ? "https://${var.domain_name}/auth/callback" : null,
    "https://${aws_cloudfront_distribution.site.domain_name}/auth/callback",
    "http://localhost:5173/auth/callback",
  ])
  cognito_logout_urls = compact([
    var.enable_custom_domain ? "https://${var.domain_name}/" : null,
    "https://${aws_cloudfront_distribution.site.domain_name}/",
    "http://localhost:5173/",
  ])
}

resource "null_resource" "cognito_callback_url_patch" {
  triggers = {
    user_pool_id  = aws_cognito_user_pool.main.id
    client_id     = aws_cognito_user_pool_client.spa.id
    callback_urls = join(",", local.cognito_callback_urls)
    logout_urls   = join(",", local.cognito_logout_urls)
  }

  provisioner "local-exec" {
    command = <<-EOT
      aws cognito-idp update-user-pool-client \
        --region ${var.aws_region} \
        --user-pool-id ${aws_cognito_user_pool.main.id} \
        --client-id ${aws_cognito_user_pool_client.spa.id} \
        --callback-urls ${join(" ", [for u in local.cognito_callback_urls : format("%q", u)])} \
        --logout-urls ${join(" ", [for u in local.cognito_logout_urls : format("%q", u)])} \
        --supported-identity-providers COGNITO \
        --allowed-o-auth-flows code \
        --allowed-o-auth-scopes openid email profile \
        --allowed-o-auth-flows-user-pool-client \
        --explicit-auth-flows ALLOW_REFRESH_TOKEN_AUTH ALLOW_USER_SRP_AUTH \
        --prevent-user-existence-errors ENABLED \
        --token-validity-units AccessToken=minutes,IdToken=minutes,RefreshToken=days \
        --access-token-validity 60 \
        --id-token-validity 60 \
        --refresh-token-validity 30
    EOT
  }
}
