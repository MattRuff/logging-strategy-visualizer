// Single source of truth for Datadog list prices. Lives server-side so the
// numbers never ship in the static JS bundle — clients fetch them via
// GET /api/pricing after authenticating as a Datadog user.
//
// Keep in sync with Datadog Druids when updating.

export const DEFAULT_PRICING = {
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

// Tier breakpoints reveal pricing structure, so they live here too.
// `maxTb: null` means "no upper bound" — the last row applies above 100 TB.
// (JSON can't carry Infinity; the client substitutes Number.POSITIVE_INFINITY.)
export const SIEM_TIERS = [
  { maxTb: 1.2, key: "siem_t1", label: "<1.2 TB/mo" },
  { maxTb: 2.9, key: "siem_t2", label: "1.2 – 2.9 TB/mo" },
  { maxTb: 5.9, key: "siem_t3", label: "3 – 5.9 TB/mo" },
  { maxTb: 9.9, key: "siem_t4", label: "6 – 9.9 TB/mo" },
  { maxTb: 14.9, key: "siem_t5", label: "10 – 14.9 TB/mo" },
  { maxTb: 22.49, key: "siem_t6", label: "15 – 22.49 TB/mo" },
  { maxTb: 29.9, key: "siem_t7", label: "22.5 – 29.9 TB/mo" },
  { maxTb: 59.9, key: "siem_t8", label: "30 – 59.9 TB/mo" },
  { maxTb: 99.9, key: "siem_t9", label: "60 – 99.9 TB/mo" },
  { maxTb: null, key: "siem_t10", label: "100+ TB/mo" },
];
