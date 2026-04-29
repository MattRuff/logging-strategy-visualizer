import { Link } from "react-router-dom";
import {
  DEFAULT_PRICING,
  FLEX_TIER_CAPACITIES,
  SIEM_TIERS,
  type PricingKey,
} from "@/model/pricingCatalog";
import { useStrategyStore } from "@/state/strategyStore";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

const eventsFmt = (n: number) =>
  n >= 1e12
    ? `${(n / 1e12).toFixed(1)}T`
    : n >= 1e9
      ? `${(n / 1e9).toFixed(0)}B`
      : `${(n / 1e6).toFixed(0)}M`;

interface PriceRow {
  key: PricingKey;
  category: string;
  description: string;
  unit: string;
}

const PRICE_ROWS: PriceRow[] = [
  {
    key: "op_monthly_per_op",
    category: "Pipelines",
    description: "Observability Pipelines Plus (OP)",
    unit: "$/OP/mo (1 OP = 1 TB/day)",
  },
  {
    key: "log_ingest_per_million",
    category: "Ingest",
    description: "Log ingestion",
    unit: "$/M log lines",
  },
  {
    key: "std_3d",
    category: "Standard Index",
    description: "Standard Index (≤ 3 days)",
    unit: "$/M log lines",
  },
  {
    key: "std_7d",
    category: "Standard Index",
    description: "Standard Index (≤ 7 days)",
    unit: "$/M log lines",
  },
  {
    key: "std_15d",
    category: "Standard Index",
    description: "Standard Index (≤ 15 days)",
    unit: "$/M log lines",
  },
  {
    key: "std_30d",
    category: "Standard Index",
    description: "Standard Index (≤ 30 days)",
    unit: "$/M log lines",
  },
  {
    key: "flex_bucket_per_30d",
    category: "Flex Storage",
    description: "Flex storage bucket (per 30-day retention)",
    unit: "$/M lines/30d",
  },
  {
    key: "flex_compute_xs",
    category: "Flex Compute",
    description: "Flex Compute — Extra Small",
    unit: "$/mo flat",
  },
  {
    key: "flex_compute_sm",
    category: "Flex Compute",
    description: "Flex Compute — Small",
    unit: "$/mo flat",
  },
  {
    key: "flex_compute_md",
    category: "Flex Compute",
    description: "Flex Compute — Medium",
    unit: "$/mo flat",
  },
  {
    key: "flex_compute_lg",
    category: "Flex Compute",
    description: "Flex Compute — Large",
    unit: "$/mo flat",
  },
  {
    key: "flex_starter_per_million_30d",
    category: "Flex Starter",
    description: "Flex Logs Starter (no compute)",
    unit: "$/M lines/30d",
  },
  {
    key: "archive_search_per_gb",
    category: "Archive Search",
    description: "Archive Search — GB scanned",
    unit: "$/GB scanned",
  },
];

const SIEM_DESCRIPTIONS: Record<string, string> = {
  siem_t1: "<1.2 TB/mo",
  siem_t2: "1.2 – 2.9 TB/mo",
  siem_t3: "3 – 5.9 TB/mo",
  siem_t4: "6 – 9.9 TB/mo",
  siem_t5: "10 – 14.9 TB/mo",
  siem_t6: "15 – 22.49 TB/mo",
  siem_t7: "22.5 – 29.9 TB/mo",
  siem_t8: "30 – 59.9 TB/mo",
  siem_t9: "60 – 99.9 TB/mo",
  siem_t10: "100 – 249.9 TB/mo",
};

export function AdminPage() {
  const overrides = useStrategyStore((s) => s.pricingOverrides);
  const setOverride = useStrategyStore((s) => s.setPricingOverride);
  const reset = useStrategyStore((s) => s.resetPricingDefaults);

  const renderRow = (key: PricingKey, descr: string, unit: string) => {
    const def = DEFAULT_PRICING[key];
    const ov = overrides[key];
    const value = ov ?? def;
    const overridden = ov != null && ov !== def;
    return (
      <tr key={key}>
        <td className="admin-table__desc">{descr}</td>
        <td className="admin-table__unit">{unit}</td>
        <td className="admin-table__default">{currency.format(def)}</td>
        <td className="admin-table__override">
          <input
            type="number"
            min={0}
            step={0.01}
            value={value}
            onChange={(e) => {
              const n = Number(e.target.value);
              setOverride(key, Number.isFinite(n) ? n : undefined);
            }}
            className={overridden ? "admin-table__input--changed" : ""}
          />
          {overridden && (
            <button
              type="button"
              className="admin-table__reset"
              onClick={() => setOverride(key, undefined)}
              title="Reset to default"
            >
              ↺
            </button>
          )}
        </td>
        <td className="admin-table__sku">
          <code>{key}</code>
        </td>
      </tr>
    );
  };

  const grouped = PRICE_ROWS.reduce<Record<string, PriceRow[]>>((acc, r) => {
    (acc[r.category] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="admin">
      <header className="admin__header">
        <Link to="/" className="admin__back">
          ← Back to start
        </Link>
        <div>
          <div className="admin__eyebrow">Settings</div>
          <h1 className="admin__title">Pricing & how it works</h1>
        </div>
        <p className="admin__lede">
          Every list price the visualizer uses, plus the math behind each SKU.
          Edit any cell to override; a session-local override turns the input
          purple and adds a ↺ to reset.
        </p>
        <div className="admin__actions">
          <button
            type="button"
            className="admin__reset-all"
            onClick={reset}
          >
            Reset all overrides to defaults
          </button>
        </div>
      </header>

      <section className="admin__section">
        <h2 className="admin__section-title">Unit prices</h2>
        {Object.entries(grouped).map(([category, rows]) => (
          <div key={category} className="admin__price-group">
            <h3 className="admin__group-title">{category}</h3>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Unit</th>
                  <th>Default $</th>
                  <th>Override $</th>
                  <th>SKU key</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => renderRow(r.key, r.description, r.unit))}
              </tbody>
            </table>
          </div>
        ))}

        <div className="admin__price-group">
          <h3 className="admin__group-title">SIEM (volume tiers)</h3>
          <p className="admin__note">
            SIEM is priced per GB scanned with a stair-step rate that drops
            as monthly TB grows. The active tier is auto-selected from the
            volume reaching the SIEM node.
          </p>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Range</th>
                <th>Unit</th>
                <th>Default $</th>
                <th>Override $</th>
                <th>SKU key</th>
              </tr>
            </thead>
            <tbody>
              {SIEM_TIERS.map((t) =>
                renderRow(
                  t.key,
                  SIEM_DESCRIPTIONS[t.key] ?? t.label,
                  "$/GB"
                )
              )}
            </tbody>
          </table>
        </div>

        <div className="admin__price-group">
          <h3 className="admin__group-title">Flex Compute capacity</h3>
          <p className="admin__note">
            Capacity is events scanned/mo. The visualizer auto-picks the
            smallest tier whose upper bound contains the workload, where
            workload = sum of <code>mLines × (retentionDays / 30) × 1e6</code>{" "}
            across every flex storage child.
          </p>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Tier</th>
                <th>Lower bound</th>
                <th>Upper bound</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(FLEX_TIER_CAPACITIES).map(([t, c]) => (
                <tr key={t}>
                  <td>
                    <strong>{t.toUpperCase()}</strong>
                  </td>
                  <td>{eventsFmt(c.lower)} events/mo</td>
                  <td>{eventsFmt(c.upper)} events/mo</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin__section">
        <h2 className="admin__section-title">How the math works</h2>
        <div className="admin__how">
          <article>
            <h3>Volume propagation</h3>
            <p>
              Every source carries a TB/mo and an M-lines/mo number. The
              graph is walked from sources, multiplying by each edge's
              percentage. The TB and lines reaching any downstream node are
              cached as <code>nodeVolumes</code> and reused by both the cost
              sheet and the per-node price labels.
            </p>
          </article>
          <article>
            <h3>Pipelines (OP)</h3>
            <p>
              <code>OPs = ceil(TB/day reaching pipelines)</code>, monthly ={" "}
              <code>OPs × $1,950</code>. One OP covers up to 1 TB/day, so a
              graph with 30 TB/mo over a single source runs at ≈ 1 OP.
            </p>
          </article>
          <article>
            <h3>Ingest</h3>
            <p>
              <code>monthly = mLines × $0.10</code>. Volume is whatever the
              percent edges deliver to the ingest node.
            </p>
          </article>
          <article>
            <h3>Standard Index</h3>
            <p>
              Retention picks the tier (≤3, ≤7, ≤15, ≤30 days). Each tier has
              its own <code>$/M lines</code>; cost is{" "}
              <code>mLines × tierRate</code>.
            </p>
          </article>
          <article>
            <h3>Flex Storage</h3>
            <p>
              Each flex destination contributes{" "}
              <code>mLines × bucketRate × (days / 30)</code>. A 90-day bucket
              counts 3× because flex compute scans the full retention window.
              The cost sheet aggregates all flex leaves into one Flex Storage
              row.
            </p>
          </article>
          <article>
            <h3>Flex Compute</h3>
            <p>
              The compute tier (xs/sm/md/lg) is auto-derived from total
              scannable events across all flex storage children. Pricing is a
              flat monthly fee per tier, separate from storage.
            </p>
          </article>
          <article>
            <h3>Flex Logs Starter</h3>
            <p>
              Same shape as Flex Storage, but priced at{" "}
              <code>{currency.format(DEFAULT_PRICING.flex_starter_per_million_30d)}</code>
              /M lines/30d with no compute fee. Behaves as its own leaf — no
              flex_compute parent is auto-attached.
            </p>
          </article>
          <article>
            <h3>SIEM</h3>
            <p>
              Pre-ingest node priced by GB. The total TB/mo reaching the
              node selects a tier (e.g. 6–9.9 TB ⇒ $2.34/GB), then{" "}
              <code>monthly = TB × 1000 × tierRate</code>. Adding more
              sources or upping a percentage can drop you into a cheaper
              tier automatically.
            </p>
          </article>
          <article>
            <h3>Archive</h3>
            <p>
              Treated as a leaf for routing but not billed by the visualizer
              (Datadog archive cost is the underlying object store).
            </p>
          </article>
          <article>
            <h3>Archive Search</h3>
            <p>
              A node downstream of an archive. Volume reaching this node is
              the portion of archived data being searched (set by the percent
              on the archive→search edge). Cost ={" "}
              <code>scannedTB × 1000 × $0.05</code>.
            </p>
          </article>
          <article>
            <h3>Overrides</h3>
            <p>
              Any value above can be overridden for the current session.
              Overrides ride along in the .xlsx export and are restored on
              import. The "Reset all overrides" button clears them.
            </p>
          </article>
        </div>
      </section>
    </div>
  );
}
