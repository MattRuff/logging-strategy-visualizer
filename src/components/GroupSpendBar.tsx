import { useMemo } from "react";
import type { LineItem, SheetDisplayType } from "@/model/types";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const TYPE_ORDER: SheetDisplayType[] = [
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

const typeClass = (t: SheetDisplayType) =>
  t.toLowerCase().replace(/\s+/g, "-");

interface GroupRow {
  id: string;
  name: string;
  color: string;
  monthly: number;
  byType: Map<SheetDisplayType, number>;
}

/**
 * One row per group + an "Ungrouped" row if applicable. Each row's bar is itself
 * stacked by node displayType (OP, Standard, Flex Storage, …), reusing the
 * existing spend-bar segment colors. Bar width = group's share of grand total.
 */
export function GroupSpendBar({ items }: { items: LineItem[] }) {
  const { rows, total, typesPresent } = useMemo(() => {
    const groups = new Map<string, GroupRow>();
    const ungrouped: GroupRow = {
      id: "__ungrouped__",
      name: "Ungrouped",
      color: "var(--dd-border-strong)",
      monthly: 0,
      byType: new Map(),
    };
    let grandTotal = 0;
    const seenTypes = new Set<SheetDisplayType>();

    for (const it of items) {
      const m = it.monthly ?? 0;
      if (m <= 0 || !Number.isFinite(m)) continue;
      grandTotal += m;
      seenTypes.add(it.displayType);
      const target =
        it.groupId &&
        (groups.get(it.groupId) ??
          (() => {
            const r: GroupRow = {
              id: it.groupId!,
              name: it.groupName ?? "Group",
              color: it.groupColor ?? "var(--dd-purple)",
              monthly: 0,
              byType: new Map(),
            };
            groups.set(it.groupId!, r);
            return r;
          })());
      const dest = target || ungrouped;
      dest.monthly += m;
      dest.byType.set(it.displayType, (dest.byType.get(it.displayType) ?? 0) + m);
    }

    const list: GroupRow[] = Array.from(groups.values()).sort(
      (a, b) => b.monthly - a.monthly
    );
    if (ungrouped.monthly > 0) list.push(ungrouped);

    return {
      rows: list,
      total: grandTotal,
      typesPresent: TYPE_ORDER.filter((t) => seenTypes.has(t)),
    };
  }, [items]);

  const hasAnyGroup = rows.some((r) => r.id !== "__ungrouped__");
  if (!hasAnyGroup || total <= 0) return null;

  return (
    <div className="spend-bar spend-by-group">
      <div className="spend-bar__header">
        <span className="spend-bar__title">Spend by group</span>
        <span className="spend-bar__total">{currency.format(total)}/mo</span>
      </div>

      <div className="spend-by-group__rows">
        {rows.map((r) => {
          const groupPct = total > 0 ? (r.monthly / total) * 100 : 0;
          return (
            <div key={r.id} className="spend-by-group__row">
              <div className="spend-by-group__label" title={r.name}>
                <span
                  className="spend-by-group__chip"
                  style={{ background: r.color }}
                  aria-hidden="true"
                />
                {r.name}
              </div>
              <div
                className="spend-bar__bar"
                title={`${r.name}: ${currency.format(r.monthly)} (${groupPct.toFixed(1)}% of total)`}
                style={{ width: `${groupPct}%` }}
              >
                {typesPresent.map((t) => {
                  const v = r.byType.get(t) ?? 0;
                  if (v <= 0) return null;
                  const pctOfRow = (v / r.monthly) * 100;
                  return (
                    <div
                      key={t}
                      className={`spend-bar__seg spend-bar__seg--${typeClass(t)}`}
                      style={{ width: `${pctOfRow}%` }}
                      title={`${t}: ${currency.format(v)}`}
                    />
                  );
                })}
              </div>
              <div className="spend-by-group__amount">
                {currency.format(r.monthly)}
                <span className="spend-by-group__pct">{groupPct.toFixed(1)}%</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="spend-bar__legend">
        {typesPresent.map((t) => (
          <span
            key={t}
            className={`spend-bar__legend-item spend-bar__legend-item--${typeClass(t)}`}
          >
            <span className="spend-bar__legend-dot" />
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
