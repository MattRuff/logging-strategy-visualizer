/**
 * Default list prices — align with Datadog Druids (internal docs) when updating.
 * See DRUIDS_SOURCES.md in repo root.
 */

export type PricingKey =
  | "op_monthly_per_op"
  | "log_ingest_per_million"
  | "std_3d"
  | "std_7d"
  | "std_15d"
  | "std_30d"
  | "flex_bucket_per_30d"
  | "flex_compute_xs"
  | "flex_compute_sm"
  | "flex_compute_md"
  | "flex_compute_lg";

export const DEFAULT_PRICING: Record<PricingKey, number> = {
  op_monthly_per_op: 1950,
  log_ingest_per_million: 0.1,
  std_3d: 1.06,
  std_7d: 1.27,
  std_15d: 1.7,
  std_30d: 2.5,
  flex_bucket_per_30d: 0.05,
  flex_compute_xs: 9000,
  flex_compute_sm: 31500,
  flex_compute_md: 67500,
  flex_compute_lg: 135000,
};

export type FlexComputeTier = "xs" | "sm" | "md" | "lg";

export function flexTierToPricingKey(t: FlexComputeTier): PricingKey {
  const m: Record<FlexComputeTier, PricingKey> = {
    xs: "flex_compute_xs",
    sm: "flex_compute_sm",
    md: "flex_compute_md",
    lg: "flex_compute_lg",
  };
  return m[t];
}

/** Map indexed retention (days) to list-price key (nearest tier). */
export function indexedRetentionToKey(retentionDays: number): PricingKey {
  const d = retentionDays;
  if (d <= 3) return "std_3d";
  if (d <= 7) return "std_7d";
  if (d <= 15) return "std_15d";
  return "std_30d";
}

export function resolvePrice(
  key: PricingKey,
  overrides: Partial<Record<PricingKey, number>>
): number {
  const v = overrides[key];
  if (v != null && Number.isFinite(v)) return v;
  return DEFAULT_PRICING[key];
}
