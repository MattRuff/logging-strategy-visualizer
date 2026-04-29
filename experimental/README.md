# Experimental tier — Google login + auto-save + archive

This directory contains an **isolated** experimental version of the app that adds:
- Google login (via Cognito Hosted UI federated to Google)
- Per-user auto-save of workloads to DynamoDB
- A "publish to archive" flow so workloads can be shared globally read-only

It is deployed as a **separate** static site behind a **separate** CloudFront distribution, backed by a **separate** Terraform state. **Nothing in this directory modifies the stable site.**

## Isolation contract

The stable deployment is the source of truth and must keep working unattended. To preserve that:

| Stable (read-only from this directory) | Experimental (lives here) |
| --- | --- |
| `../terraform/` | `experimental/terraform/` (separate state key) |
| `../src/` | `experimental/app/src/` (imports from `../src` via Vite alias) |
| `../.github/workflows/deploy-aws.yml` | `../.github/workflows/deploy-experimental.yml` |
| Existing S3 bucket + CloudFront distribution | New S3 bucket + new CloudFront distribution |
| IAM deploy role for stable | **Separate** IAM deploy role scoped to experimental ARNs only |

Rules:
1. Do not modify any file outside `experimental/` or `.github/workflows/deploy-experimental.yml` from this initiative. The experimental SPA imports stable code read-only.
2. The Terraform state for `experimental/terraform/` MUST use a different S3 backend key (e.g. `experimental/terraform.tfstate`) from `../terraform/`. Document this in `backend.tf` when you wire up remote state.
3. The IAM role used by the experimental deploy workflow MUST NOT include the stable bucket ARN or stable CloudFront distribution ARN in any policy. This is the deployment-level guarantee that experimental cannot break stable.

## Layout

```
experimental/
├── README.md                  this file
├── app/                       Vite SPA (separate build output from stable)
│   └── src/
│       ├── main.tsx           entry; wraps stable Visualizer in AuthProvider
│       ├── App.tsx            experimental router
│       ├── auth/              oidc-client-ts wrapper + React context
│       ├── pages/             AuthCallback, MyWorkloads, Archive, VisualizerWrapped
│       ├── lib/workloadApi.ts fetch wrapper; injects Bearer token
│       ├── state/useAutoSave.ts debounced subscriber to stable strategyStore
│       └── config/runtime.ts  generated at build time, gitignored
├── lambda/                    five Node 22 ESM Lambdas + shared helpers
└── terraform/                 separate stack: Cognito, DynamoDB, API Gateway, Lambda, CloudFront, S3
```

## Deploy order (first time)

1. Create a Google OAuth 2.0 client (type: Web application). Authorized redirect URI = `https://<your-cognito-domain>.auth.<region>.amazoncognito.com/oauth2/idpresponse`. Store the client_id and client_secret in AWS Secrets Manager and put the secret ARN into `terraform.tfvars` as `google_oauth_secret_arn`.
2. `cd experimental/terraform && terraform init && terraform plan` — verify only *create* operations (no diffs against stable resources).
3. `terraform apply`, then capture outputs (`cognito_user_pool_id`, `cognito_user_pool_client_id`, `cognito_domain`, `cloudfront_distribution_id`, `experimental_site_bucket`, `api_invoke_url`).
4. Set those outputs as GitHub repository variables (or environment variables for the experimental deploy workflow).
5. Push to `main` (or trigger `Deploy experimental` manually) → SPA + Lambdas deploy.
6. Visit the experimental CloudFront URL. The stable site URL is unaffected.

## Promotion path (when ready)

When the experimental tier is validated and you want it to become the main site, the migration is roughly: copy `experimental/app/src/auth`, `lib/workloadApi.ts`, `state/useAutoSave.ts`, and the new pages into `src/`, fold the auth-aware infra into `terraform/`, and retire `experimental/`. That decision is **out of scope** for this initiative.
