/**
 * Pricing catalog — values are fetched from GET /api/pricing at app boot and
 * installed via setPricingCatalog(). The static bundle ships zero numbers so
 * an unauthenticated viewer of the JS can't read list prices.
 *
 * Helpers like resolvePrice / siemTierForTb assume the catalog has been
 * hydrated; calling them before hydration throws. RequireDatadogUser blocks
 * route rendering until hydration completes.
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

export interface SiemTier {
  maxTb: number; // POSITIVE_INFINITY for the top tier
  key: PricingKey;
  label: string;
}

export interface PricingCatalog {
  pricing: Record<PricingKey, number>;
  siemTiers: ReadonlyArray<SiemTier>;
}

/**
 * GB per TB used for the SIEM volume → $ conversion. Not a price.
 */
export const GB_PER_TB = 1000;

let _catalog: PricingCatalog | null = null;

export function setPricingCatalog(c: PricingCatalog): void {
  _catalog = {
    pricing: { ...c.pricing },
    siemTiers: c.siemTiers.map((t) => ({
      maxTb: Number.isFinite(t.maxTb) ? t.maxTb : Number.POSITIVE_INFINITY,
      key: t.key,
      label: t.label,
    })),
  };
}

export function isPricingCatalogLoaded(): boolean {
  return _catalog !== null;
}

function requireCatalog(): PricingCatalog {
  if (!_catalog) {
    throw new Error(
      "Pricing catalog not loaded. RequireDatadogUser should hydrate it before any route renders."
    );
  }
  return _catalog;
}

export function getDefaultPricing(): Record<PricingKey, number> {
  return requireCatalog().pricing;
}

export function getSiemTiers(): ReadonlyArray<SiemTier> {
  return requireCatalog().siemTiers;
}

/** Pick the SIEM tier covering the given TB/mo. */
export function siemTierForTb(tbMo: number): SiemTier {
  const tiers = getSiemTiers();
  for (const t of tiers) {
    if (tbMo <= t.maxTb) return t;
  }
  return tiers[tiers.length - 1];
}

export type FlexComputeTier = "xs" | "sm" | "md" | "lg";

/**
 * Flex Logs compute-tier capacity in events scanned per month. These bounds are
 * publicly documented technical capacities (not list prices), so they stay
 * client-side.
 */
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
  return requireCatalog().pricing[key];
}
