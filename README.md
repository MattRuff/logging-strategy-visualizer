# Logging strategy visualizer

Interactive **flow diagram** plus **cost sheet** for Datadog logging routing (Observability Pipelines, ingestion, indexed hot storage, Flex storage + compute, archive). Hosted multi-user app with email/password sign-in, per-user auto-saved scenarios, and a global archive.

Edge **%** values sync with the sheet; **quantity** is derived and read-only; **Unit $** uses defaults from [`src/model/pricingCatalog.ts`](src/model/pricingCatalog.ts) (verify against [Druids](https://druids.datadoghq.com/) on VPN) and can be **overridden** in the sheet. Use **Reset pricing** to clear overrides.

## Local development

```bash
npm install
cp env.local.example .env.local        # fill in Cognito + API values from `terraform output`
npm run dev                              # http://localhost:5173
```

Cognito callbacks already include `http://localhost:5173/auth/callback`, so you can sign in against the live user pool from a local dev server.

## Architecture

```
                            ┌──────────────────────────┐
                            │ Cognito User Pool         │
                            │   • Hosted UI (signup,    │
                            │     verify, sign-in)      │
                            │   • Issues JWT (id_token) │
                            └──────────────┬────────────┘
                                           │ OIDC code flow
                                           ▼
   Browser ──► CloudFront ──► S3 (SPA: Vite + React)
       │            │
       │            └─► /api/* ──► API Gateway (HTTP API, JWT authorizer)
       │                                │
       │                                ▼
       │                        ┌──────────────────────┐
       │                        │ 5 Lambdas (Node 22)  │
       │                        │   saveWorkload  PUT  │
       │                        │   loadWorkload  GET  │
       │                        │   listMyWorkloads    │
       │                        │   publish       POST │
       │                        │   listArchive   GET  │
       │                        └──────────┬───────────┘
       │                                   ▼
       │                         DynamoDB (workloads table)
       ▼
  Bearer <id_token> on every /api/* call
```

CloudFront has two origins: the SPA bucket (default behavior, cached) and the API (`/api/*` behavior, cache disabled). Traffic is same-origin, so no CORS preflight in production.

## Layout

```
.
├── src/                       Vite + React SPA
│   ├── main.tsx, App.tsx      entry + router
│   ├── auth/                  oidc-client-ts wrapper + AuthProvider
│   ├── components/            Toolbar (top bar), Palette, FlowCanvas, CostSheet, …
│   ├── pages/                 Landing, Visualizer, Pricing, Hybrid, MyWorkloads, Archive, AuthCallback, WorkloadShell
│   ├── lib/                   workloadApi (Bearer-token fetch), hydrateStore, xlsxSync
│   ├── state/                 strategyStore (zustand), useAutoSave
│   ├── model/                 graph math, pricing catalog, sheet line items
│   ├── templates/             starter strategies
│   └── config/runtime.ts      build-time runtime config (read from VITE_* env vars)
├── lambda/                    five Node 22 ESM handlers + shared helpers
└── terraform/                 Cognito, DynamoDB, API Gateway, Lambda, CloudFront, S3
```

## Deploy (first time)

1. **Pick a Cognito domain prefix** (must be globally unique per region) and set tfvars:
   ```bash
   cd terraform
   cp terraform.tfvars.example terraform.tfvars
   # set project_name, aws_region, cognito_domain_prefix
   ```
   (Optionally) `cp backend.tf.example backend.tf` and configure remote state.
2. **Apply Terraform:**
   ```bash
   terraform init
   terraform plan
   terraform apply
   ```
3. **Wire up GitHub Actions.** From `terraform output`, set these repository variables (Settings → Actions → Variables):

   | Variable                    | Source                              |
   | --------------------------- | ----------------------------------- |
   | `S3_BUCKET`                 | `experimental_site_bucket`          |
   | `CLOUDFRONT_DISTRIBUTION_ID`| `cloudfront_distribution_id`        |
   | `LAMBDA_PREFIX`             | `var.project_name`                  |
   | `AWS_REGION`                | e.g. `us-east-1`                    |
   | `VITE_COGNITO_USER_POOL_ID` | `cognito_user_pool_id`              |
   | `VITE_COGNITO_CLIENT_ID`    | `cognito_user_pool_client_id`       |
   | `VITE_COGNITO_DOMAIN`       | `cognito_domain`                    |
   | `VITE_COGNITO_REGION`       | same as `AWS_REGION`                |

   And one secret:

   | Secret                  | Notes                                                              |
   | ----------------------- | ------------------------------------------------------------------ |
   | `AWS_DEPLOY_ROLE_ARN`   | IAM role scoped to the deployed S3 bucket, CloudFront, and Lambdas |

4. **Push to `main`** (or run **Deploy** via `workflow_dispatch`). The workflow uploads the SPA, invalidates CloudFront, and updates each Lambda's code.

### Custom domain (optional)

Set `enable_custom_domain = true` and provide `domain_name` + `hosted_zone_id` in `terraform.tfvars`. Terraform will request an ACM cert in `us-east-1`, validate it via Route 53, alias the CloudFront distribution, and patch the Cognito callback URL list.

## Scripts

| Command           | Description              |
| ----------------- | ------------------------ |
| `npm run dev`     | Dev server               |
| `npm run build`   | Typecheck + build        |
| `npm run preview` | Preview production build |
| `npm run test`    | Vitest unit tests        |

## Notes

- **Pricing defaults**: Align `DEFAULT_PRICING` with internal Druids list prices when they change; note the review date in [`DRUIDS_SOURCES.md`](DRUIDS_SOURCES.md).
- **Observability**: Datadog Browser RUM is initialized in `src/main.tsx`. For Lambda traces, attach the Datadog Lambda Extension layer in `terraform/main.tf` and set `DD_API_KEY_SECRET_ARN`, `DD_SITE`, `DD_SERVICE`, `DD_ENV`.
