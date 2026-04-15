# Druids sourcing (internal)

Default prices in `src/model/pricingCatalog.ts` should be checked against **Datadog Druids** (`https://druids.datadoghq.com/`) for:

- Logs — ingestion, indexed retention tiers
- Observability Pipelines Plus — OP+ and TB-day rules
- Flex Logs — storage (30-day buckets) and compute tiers

Update `DEFAULT_PRICING` after verifying list prices on VPN/SSO. Note the review date in `README.md`.
