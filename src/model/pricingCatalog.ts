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
  | "flex_compute_lg"
  | "flex_starter_per_million_30d"
  | "archive_search_per_gb"
  | "siem_t1"
  | "siem_t2"
  | "siem_t3"
  | "siem_t4"
  | "siem_t5"
  | "siem_t6"
  | "siem_t7"
  | "siem_t8"
  | "siem_t9"
  | "siem_t10";

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
  flex_starter_per_million_30d: 0.6,
  archive_search_per_gb: 0.05,
  // SIEM volume tiers ($/GB scanned, by total TB/mo)
  siem_t1: 5.0,
  siem_t2: 3.37,
  siem_t3: 2.81,
  siem_t4: 2.34,
  siem_t5: 1.95,
  siem_t6: 1.62,
  siem_t7: 1.4,
  siem_t8: 1.22,
  siem_t9: 1.08,
  siem_t10: 0.94,
};

/**
 * GB per TB used for the SIEM volume → $ conversion. Pricing tables typically
 * use decimal TB (1 TB = 1000 GB) rather than binary; keep this constant central
 * so a future change to binary is one edit.
 */
export const GB_PER_TB = 1000;

/** SIEM volume tiers — pick the row whose maxTb >= tbMo. Last row applies above 100TB. */
export const SIEM_TIERS: ReadonlyArray<{
  maxTb: number;
  key: PricingKey;
  label: string;
}> = [
  { maxTb: 1.2, key: "siem_t1", label: "<1.2 TB" },
  { maxTb: 2.9, key: "siem_t2", label: "1.2–2.9 TB" },
  { maxTb: 5.9, key: "siem_t3", label: "3–5.9 TB" },
  { maxTb: 9.9, key: "siem_t4", label: "6–9.9 TB" },
  { maxTb: 14.9, key: "siem_t5", label: "10–14.9 TB" },
  { maxTb: 22.49, key: "siem_t6", label: "15–22.49 TB" },
  { maxTb: 29.9, key: "siem_t7", label: "22.5–29.9 TB" },
  { maxTb: 59.9, key: "siem_t8", label: "30–59.9 TB" },
  { maxTb: 99.9, key: "siem_t9", label: "60–99.9 TB" },
  { maxTb: Number.POSITIVE_INFINITY, key: "siem_t10", label: "100+ TB" },
];

/** Pick the SIEM tier covering the given TB/mo. */
export function siemTierForTb(tbMo: number): (typeof SIEM_TIERS)[number] {
  for (const t of SIEM_TIERS) {
    if (tbMo <= t.maxTb) return t;
  }
  return SIEM_TIERS[SIEM_TIERS.length - 1];
}

export type FlexComputeTier = "xs" | "sm" | "md" | "lg";

/** Datadog Flex Logs compute-tier capacity in events scanned per month (lower–upper bounds). */
export const FLEX_TIER_CAPACITIES: Record<
  FlexComputeTier,
  { lower: number; upper: number }
> = {
  xs: { lower: 10e9, upper: 50e9 },
  sm: { lower: 50e9, upper: 200e9 },
  md: { lower: 200e9, upper: 500e9 },
  lg: { lower: 500e9, upper: 1e12 },
};

export function tierCapacityForTier(t: FlexComputeTier) {
  return FLEX_TIER_CAPACITIES[t];
}

/** Smallest tier whose upper bound contains the given events/month; lg if all are exceeded. */
export function pickFlexComputeTier(events: number): FlexComputeTier {
  if (events <= FLEX_TIER_CAPACITIES.xs.upper) return "xs";
  if (events <= FLEX_TIER_CAPACITIES.sm.upper) return "sm";
  if (events <= FLEX_TIER_CAPACITIES.md.upper) return "md";
  return "lg";
}

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
