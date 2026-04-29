import { useStrategyStore } from "@/state/strategyStore";
import type { SheetDisplayType } from "@/model/types";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const SEGMENT_ORDER: SheetDisplayType[] = [
  "OP",
  "SIEM",
  "Ingest",
  "Standard",
  "Flex Storage",
  "Flex Compute",
  "Flex Starter",
  "Archive",
  "Archive Search",
];

export function SpendBar() {
  const items = useStrategyStore((s) => s.sheetLineItems);
  const totalsByType = new Map<SheetDisplayType, number>();
  let total = 0;
  for (const r of items) {
    if (r.monthly == null || !Number.isFinite(r.monthly)) continue;
    totalsByType.set(
      r.displayType,
      (totalsByType.get(r.displayType) ?? 0) + r.monthly
    );
    total += r.monthly;
  }

  if (total <= 0) return null;

  const segments = SEGMENT_ORDER
    .map((t) => ({ type: t, monthly: totalsByType.get(t) ?? 0 }))
    .filter((s) => s.monthly > 0);

  return (
    <div className="spend-bar">
      <div className="spend-bar__header">
        <span className="spend-bar__title">% of total spend</span>
        <span className="spend-bar__total">
          {currency.format(total)}/mo
        </span>
      </div>
      <div className="spend-bar__bar">
        {segments.map((seg) => {
          const pct = (seg.monthly / total) * 100;
          return (
            <div
              key={seg.type}
              className={`spend-bar__seg spend-bar__seg--${seg.type
                .toLowerCase()
                .replace(/\s+/g, "-")}`}
              style={{ width: `${pct}%` }}
              title={`${seg.type}: ${currency.format(seg.monthly)} (${pct.toFixed(1)}%)`}
            />
          );
        })}
      </div>
      <div className="spend-bar__legend">
        {segments.map((seg) => {
          const pct = (seg.monthly / total) * 100;
          return (
            <span
              key={seg.type}
              className={`spend-bar__legend-item spend-bar__legend-item--${seg.type
                .toLowerCase()
                .replace(/\s+/g, "-")}`}
            >
              <span className="spend-bar__legend-dot" />
              {seg.type} · {pct.toFixed(1)}%
            </span>
          );
        })}
      </div>
    </div>
  );
}
