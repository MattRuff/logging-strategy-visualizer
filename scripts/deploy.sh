#!/usr/bin/env bash
set -euo pipefail

# One-shot deploy: build → S3 sync → source maps → CloudFront invalidate → terraform apply.
# Run from repo root via `npm run deploy`.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BUCKET="logging-strategy-experimental-site-45a6a47e"
DISTRIBUTION_ID="ESFXE4T8D7FI5"
SECRET_ID="logging-strategy-experimental/datadog-api-key"
AWS_VAULT_PROFILE="${AWS_VAULT_PROFILE:-sso-ese-sandbox-account-admin}"

# aws-vault wraps every AWS call so terraform + cli use the same SSO creds.
AWS=(aws-vault exec "$AWS_VAULT_PROFILE" --)

echo "▶ build"
npm run build

echo "▶ s3 sync (excluding .map — source maps stay private to Datadog)"
"${AWS[@]}" aws s3 sync dist/ "s3://$BUCKET/" --delete --exclude "*.map"

echo "▶ upload source maps to Datadog"
DATADOG_API_KEY=$("${AWS[@]}" aws secretsmanager get-secret-value \
  --secret-id "$SECRET_ID" --query SecretString --output text)
export DATADOG_API_KEY
npm run upload-sourcemaps

echo "▶ cloudfront invalidate"
"${AWS[@]}" aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" --paths "/*" >/dev/null

echo "▶ terraform apply (refreshes Lambda DD_GIT_COMMIT_SHA + DD_VERSION)"
"${AWS[@]}" terraform -chdir=terraform apply -auto-approve

echo "✅ deployed: https://d29kop72tjr4vk.cloudfront.net"
