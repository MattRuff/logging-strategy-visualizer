import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  createColumnHelper,
  type ColumnSizingState,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import {
  FLEX_RETENTION_DAY_OPTIONS,
  nearestFlexRetentionDays,
} from "@/model/flexRetention";
import type { LineItem } from "@/model/types";
import { useStrategyStore } from "@/state/strategyStore";
import { GroupSpendBar } from "@/components/GroupSpendBar";

const helper = createColumnHelper<LineItem>();

const TYPE_BADGE_CLASS: Record<LineItem["displayType"], string> = {
  OP: "sheet-badge--op",
  SIEM: "sheet-badge--siem",
  Ingest: "sheet-badge--ingest",
  "Flex Storage": "sheet-badge--flex-storage",
  "Flex Compute": "sheet-badge--flex-compute",
  "Flex Starter": "sheet-badge--flex-starter",
  Standard: "sheet-badge--standard",
  Archive: "sheet-badge--archive",
  "Archive Search": "sheet-badge--archive-search",
};

function TypeBadge({ displayType }: { displayType: LineItem["displayType"] }) {
  return (
    <span className={`sheet-badge ${TYPE_BADGE_CLASS[displayType]}`}>
      {displayType}
    </span>
  );
}

export function CostSheet() {
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const sheetLineItems = useStrategyStore((s) => s.sheetLineItems);
  const nodes = useStrategyStore((s) => s.nodes);
  const updateNodeData = useStrategyStore((s) => s.updateNodeData);
  const setPricingOverride = useStrategyStore((s) => s.setPricingOverride);
  const applyRoutePctFromSheet = useStrategyStore(
    (s) => s.applyRoutePctFromSheet
  );
  const getGrandTotals = useStrategyStore((s) => s.getGrandTotals);
  const getSplitValidations = useStrategyStore((s) => s.getSplitValidations);
  const sheetConflicts = useStrategyStore((s) => s.sheetConflicts);

  const totals = getGrandTotals();
  const splits = getSplitValidations();

  const columns = useMemo(
    () => [
      helper.display({
        id: "displayType",
        header: "Type",
        cell: (ctx) => (
          <TypeBadge displayType={ctx.row.original.displayType} />
        ),
        size: 120,
      }),
      helper.accessor("pctOfTotal", {
        size: 100,
        header: "% of total",
        cell: (ctx) => {
          const row = ctx.row.original;
          if (row.routeNodeId == null) {
            if (
              row.lineKind === "flex_aggregate" &&
              row.pctOfTotal != null
            ) {
              return (
                <span className="sheet-num sheet-num--readonly">
                  {row.pctOfTotal}%
                </span>
              );
            }
            return <span className="sheet-muted">—</span>;
          }
          const v = row.pctOfTotal;
          return (
            <input
              className="sheet-input sheet-input--purple"
              type="number"
              defaultValue={v ?? ""}
              key={`${row.id}-${v}`}
              onBlur={(e) => {
                const n = Number(e.target.value);
                if (!Number.isFinite(n)) return;
                applyRoutePctFromSheet(row.routeNodeId!, n);
              }}
            />
          );
        },
      }),
      helper.display({
        id: "nodeLabel",
        size: 160,
        header: "Name",
        cell: (ctx) => {
          const row = ctx.row.original;
          if (row.lineKind === "flex_compute") {
            return <span className="sheet-muted">—</span>;
          }
          if (row.lineKind === "flex_aggregate") {
            const v = row.nodeLabel;
            return v != null && v !== "" ? (
              <span className="sheet-name">{v}</span>
            ) : (
              <span className="sheet-muted">—</span>
            );
          }
          if (row.lineKind !== "node" || !row.routeNodeId) {
            const v = row.nodeLabel;
            return v != null && v !== "" ? (
              <span className="sheet-name">{v}</span>
            ) : (
              <span className="sheet-muted">—</span>
            );
          }
          return (
            <input
              className="sheet-input sheet-input--blue"
              type="text"
              defaultValue={row.nodeLabel ?? ""}
              key={`${row.id}-name-${row.nodeLabel}`}
              onBlur={(e) =>
                updateNodeData(row.routeNodeId!, {
                  label: e.target.value,
                })
              }
            />
          );
        },
      }),
      helper.display({
        id: "description",
        size: 240,
        header: "Description",
        cell: (ctx) => {
          const row = ctx.row.original;
          if (row.lineKind === "flex_aggregate" && row.routeNodeId) {
            const raw =
              nodes.find((n) => n.id === row.routeNodeId)?.data
                .flexRetentionDays ?? 30;
            const days = FLEX_RETENTION_DAY_OPTIONS.includes(raw)
              ? raw
              : nearestFlexRetentionDays(raw);
            return (
              <div className="sheet-desc-row">
                <span className="sheet-desc-text">{row.description}</span>
                <select
                  className="sheet-select"
                  value={days}
                  onChange={(e) => {
                    const d = Number(e.target.value);
                    updateNodeData(row.routeNodeId!, {
                      flexRetentionDays: d,
                    });
                  }}
                >
                  {FLEX_RETENTION_DAY_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}d
                    </option>
                  ))}
                </select>
              </div>
            );
          }
          if (row.lineKind === "node" && row.routeNodeId) {
            const node = nodes.find((n) => n.id === row.routeNodeId);
            if (node?.data.kind === "index") {
              const days = node.data.retentionDays ?? 3;
              return (
                <div className="sheet-desc-row">
                  <span className="sheet-desc-text">{row.description}</span>
                  <select
                    className="sheet-select"
                    value={days}
                    onChange={(e) => {
                      const d = Number(e.target.value);
                      updateNodeData(row.routeNodeId!, {
                        retentionDays: d,
                        label: `Indexed ${d}d`,
                      });
                    }}
                  >
                    <option value={3}>3d</option>
                    <option value={7}>7d</option>
                    <option value={15}>15d</option>
                    <option value={30}>30d</option>
                  </select>
                </div>
              );
            }
          }
          return (
            <span className="sheet-input--blue">{row.description}</span>
          );
        },
      }),
      helper.accessor("quantityPerMonth", {
        size: 110,
        header: "Qty / mo",
        cell: (ctx) => (
          <span className="sheet-num sheet-num--readonly">
            {ctx.row.original.quantityPerMonth != null
              ? ctx.row.original.quantityPerMonth.toLocaleString(undefined, {
                  maximumFractionDigits: 4,
                })
              : "—"}
          </span>
        ),
      }),
      helper.accessor("unitPrice", {
        size: 96,
        header: "Unit $",
        cell: (ctx) => {
          const row = ctx.row.original;
          if (row.pricingKey == null) {
            return (
              <span className="sheet-num">
                {row.unitPrice != null ? row.unitPrice : "—"}
              </span>
            );
          }
          return (
            <input
              className="sheet-input sheet-input--yellow"
              type="number"
              step={0.0001}
              defaultValue={row.unitPrice ?? ""}
              key={`${row.id}-${row.unitPrice}-${row.pricingKey}`}
              onBlur={(e) => {
                const n = Number(e.target.value);
                if (!Number.isFinite(n)) return;
                setPricingOverride(row.pricingKey!, n);
              }}
            />
          );
        },
      }),
      helper.accessor("monthly", {
        size: 104,
        header: "Monthly",
        cell: (ctx) => (
          <span className="sheet-num">
            {ctx.row.original.monthly != null
              ? ctx.row.original.monthly.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })
              : "—"}
          </span>
        ),
      }),
      helper.accessor("annual", {
        size: 104,
        header: "Annual",
        cell: (ctx) => (
          <span className="sheet-num">
            {ctx.row.original.annual != null
              ? ctx.row.original.annual.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })
              : "—"}
          </span>
        ),
      }),
      helper.accessor("millionLinesNote", {
        size: 140,
        header: "Notes",
        cell: (ctx) => (
          <span className="sheet-note">{ctx.row.original.millionLinesNote}</span>
        ),
      }),
    ],
    [
      applyRoutePctFromSheet,
      nodes,
      setPricingOverride,
      updateNodeData,
    ]
  );

  // Cluster items by group so the table can render group section headers + subtotals.
  // Ungrouped rows come first (groupId = ""), then each group's rows in original order.
  const sortedItems = useMemo(() => {
    return [...sheetLineItems]
      .map((it, i) => [it, i] as const)
      .sort((a, b) => {
        const ga = a[0].groupId ?? "";
        const gb = b[0].groupId ?? "";
        if (ga !== gb) return ga.localeCompare(gb);
        return a[1] - b[1];
      })
      .map(([it]) => it);
  }, [sheetLineItems]);

  const groupSubtotals = useMemo(() => {
    const m = new Map<string, { name: string; monthly: number; annual: number }>();
    for (const it of sheetLineItems) {
      if (!it.groupId) continue;
      const cur = m.get(it.groupId) ?? {
        name: it.groupName ?? "Group",
        monthly: 0,
        annual: 0,
      };
      cur.monthly += it.monthly ?? 0;
      cur.annual += it.annual ?? 0;
      m.set(it.groupId, cur);
    }
    return m;
  }, [sheetLineItems]);

  const table = useReactTable({
    data: sortedItems,
    columns,
    state: { columnSizing },
    onColumnSizingChange: setColumnSizing,
    columnResizeMode: "onChange",
    enableColumnResizing: true,
    defaultColumn: {
      minSize: 56,
      maxSize: 640,
      size: 120,
    },
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <section className="cost-sheet">
      <div className="cost-sheet__header">
        <h2>Cost sheet</h2>
        <div className="cost-sheet__totals">
          <span>
            Monthly total:{" "}
            <strong>
              {totals.monthly.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}
            </strong>
          </span>
          <span>
            Annual total:{" "}
            <strong>
              {totals.annual.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}
            </strong>
          </span>
        </div>
      </div>

      {sheetLineItems.some((it) => it.groupId) ? (
        <GroupSpendBar items={sheetLineItems} />
      ) : (
        <div className="split-bar">
          {splits.map((s) => (
            <span
              key={s.nodeId}
              className={`split-pill ${s.ok ? "split-pill--ok" : "split-pill--bad"}`}
              title={s.label}
            >
              {s.label}: {s.sumPct}% {s.ok ? "✓" : "≠ 100%"}
            </span>
          ))}
        </div>
      )}

      {sheetConflicts.length > 0 ? (
        <div className="sheet-conflicts" role="alert">
          {sheetConflicts.map((c) => (
            <div key={c}>{c}</div>
          ))}
        </div>
      ) : null}

      <div className="sheet-table-wrap">
        <table
          className="sheet-table sheet-table--resizable"
          style={{ width: table.getTotalSize() }}
        >
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className="sheet-table__th"
                    style={{ width: h.getSize() }}
                  >
                    {h.isPlaceholder ? null : (
                      <>
                        <span className="sheet-table__th-label">
                          {flexRender(h.column.columnDef.header, h.getContext())}
                        </span>
                        {h.column.getCanResize() ? (
                          <button
                            type="button"
                            aria-label={`Resize ${h.column.id} column`}
                            className={`sheet-col-resizer ${
                              h.column.getIsResizing() ? "sheet-col-resizer--active" : ""
                            }`}
                            onMouseDown={h.getResizeHandler()}
                            onTouchStart={h.getResizeHandler()}
                          />
                        ) : null}
                      </>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {(() => {
              const rows = table.getRowModel().rows;
              const out: React.ReactNode[] = [];
              const headers = table.getHeaderGroups()[0]?.headers ?? [];
              const colCount = headers.length || 1;
              const headerIds = headers.map((h) => h.id);
              const monthlyIdx = headerIds.indexOf("monthly");
              const annualIdx = headerIds.indexOf("annual");
              const fmt = (n: number) =>
                n.toLocaleString(undefined, { maximumFractionDigits: 2 });
              let prevGroupId: string | undefined;
              const flushSubtotal = (gid: string) => {
                const sub = groupSubtotals.get(gid);
                if (!sub) return;
                // Pivot-style row: empty cells aligned with each column, with the
                // monthly/annual subtotal sitting directly under their columns.
                if (monthlyIdx >= 0 && annualIdx > monthlyIdx) {
                  const before = monthlyIdx;
                  const between = annualIdx - monthlyIdx - 1;
                  const after = colCount - annualIdx - 1;
                  out.push(
                    <tr key={`grp-sub-${gid}`} className="sheet-row--group-subtotal">
                      <td
                        colSpan={before}
                        className="sheet-group-subtotal__label-cell"
                      >
                        {sub.name} subtotal
                      </td>
                      <td className="sheet-group-subtotal__value">
                        {fmt(sub.monthly)}
                      </td>
                      {between > 0 && <td colSpan={between} />}
                      <td className="sheet-group-subtotal__value">
                        {fmt(sub.annual)}
                      </td>
                      {after > 0 && <td colSpan={after} />}
                    </tr>
                  );
                  return;
                }
                // Fallback (column ids not where expected): single colspan cell.
                out.push(
                  <tr key={`grp-sub-${gid}`} className="sheet-row--group-subtotal">
                    <td colSpan={colCount} className="sheet-group-subtotal__label-cell">
                      {sub.name} subtotal — Monthly <strong>{fmt(sub.monthly)}</strong>
                      {" · "}Annual <strong>{fmt(sub.annual)}</strong>
                    </td>
                  </tr>
                );
              };

              rows.forEach((row) => {
                const gid = row.original.groupId ?? "";
                if (gid !== (prevGroupId ?? "")) {
                  if (prevGroupId) flushSubtotal(prevGroupId);
                  if (gid) {
                    out.push(
                      <tr key={`grp-hdr-${gid}`} className="sheet-row--group-header">
                        <td colSpan={colCount}>
                          {row.original.groupName ?? "Group"}
                        </td>
                      </tr>
                    );
                  }
                  prevGroupId = gid || undefined;
                }
                out.push(
                  <tr key={row.id} className={gid ? "sheet-row--grouped" : undefined}>
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        style={{ width: cell.column.getSize() }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              });
              if (prevGroupId) flushSubtotal(prevGroupId);
              return out;
            })()}
          </tbody>
        </table>
      </div>
    </section>
  );
}
