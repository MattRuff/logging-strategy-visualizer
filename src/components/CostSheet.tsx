import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  createColumnHelper,
} from "@tanstack/react-table";
import { useMemo } from "react";
import {
  FLEX_RETENTION_DAY_OPTIONS,
  nearestFlexRetentionDays,
} from "@/model/flexRetention";
import type { LineItem } from "@/model/types";
import { useStrategyStore } from "@/state/strategyStore";

const helper = createColumnHelper<LineItem>();

const TYPE_BADGE_CLASS: Record<LineItem["displayType"], string> = {
  OP: "sheet-badge--op",
  Ingest: "sheet-badge--ingest",
  "Flex Storage": "sheet-badge--flex-storage",
  "Flex Compute": "sheet-badge--flex-compute",
  Standard: "sheet-badge--standard",
  Archive: "sheet-badge--archive",
};

function TypeBadge({ displayType }: { displayType: LineItem["displayType"] }) {
  return (
    <span className={`sheet-badge ${TYPE_BADGE_CLASS[displayType]}`}>
      {displayType}
    </span>
  );
}

export function CostSheet() {
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
        id: "description",
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
          if (row.lineKind !== "node" || !row.routeNodeId) {
            return <span className="sheet-input--blue">{row.description}</span>;
          }
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
          return (
            <input
              className="sheet-input sheet-input--blue"
              defaultValue={row.description}
              key={`${row.id}-desc`}
              onBlur={(e) =>
                updateNodeData(row.routeNodeId!, {
                  label: e.target.value,
                })
              }
            />
          );
        },
      }),
      helper.accessor("retentionMonths", {
        header: "Ret. mo",
        cell: () => <span className="sheet-muted">—</span>,
      }),
      helper.accessor("quantityPerMonth", {
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

  const table = useReactTable({
    data: sheetLineItems,
    columns,
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

      {sheetConflicts.length > 0 ? (
        <div className="sheet-conflicts" role="alert">
          {sheetConflicts.map((c) => (
            <div key={c}>{c}</div>
          ))}
        </div>
      ) : null}

      <div className="sheet-table-wrap">
        <table className="sheet-table">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} style={{ width: h.getSize() }}>
                    {h.isPlaceholder
                      ? null
                      : flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
