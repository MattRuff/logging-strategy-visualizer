# AWS static hosting (Terraform)

Provisions an **S3** bucket (private), **CloudFront** with **OAC**, and **SPA error handling** (403/404 → `/index.html`). Optionally **ACM** (us-east-1) and **Route 53** aliases when `enable_custom_domain` is true.

## Prerequisites

- [Terraform](https://www.terraform.io/) `>= 1.5`
- AWS credentials with permissions to create S3, CloudFront, IAM policy on bucket, Route53/ACM if using a custom domain

## Usage

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars

terraform init
terraform plan
terraform apply
```

After apply, use **Outputs** for CI: `s3_bucket_id`, `cloudfront_distribution_id`, `site_url`. Deploy artifacts with:

```bash
npm ci && npm run build
aws s3 sync dist/ s3://<s3_bucket_id>/ --delete
aws cloudfront create-invalidation --distribution-id <cloudfront_distribution_id> --paths "/*"
```

## CI deploy IAM

Grant the CI role/user:

- `s3:PutObject`, `s3:DeleteObject`, `s3:ListBucket` on `arn:aws:s3:::<bucket>` and `arn:aws:s3:::<bucket>/*`
- `cloudfront:CreateInvalidation` on `arn:aws:cloudfront::<account>:distribution/<id>`

The repository workflow [`.github/workflows/deploy-aws.yml`](../.github/workflows/deploy-aws.yml) expects **Actions variables** `S3_BUCKET_ID`, `CLOUDFRONT_DISTRIBUTION_ID`, and optionally `AWS_REGION`, plus secret `AWS_DEPLOY_ROLE_ARN` for OIDC-based AWS authentication.

## Remote state

See [`backend.tf.example`](backend.tf.example) for an optional S3 backend.
