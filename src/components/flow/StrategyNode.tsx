import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  DEFAULT_MILLION_LINES_PER_MONTH,
  DEFAULT_TOTAL_TB_PER_MONTH,
} from "@/model/volumeDefaults";
import { nearestFlexRetentionDays } from "@/model/flexRetention";
import {
  resolvePrice,
  tierCapacityForTier,
} from "@/model/pricingCatalog";
import type {
  StrategyNode as FlowStrategyNode,
  StrategyNodeData,
} from "@/model/types";
import { usePricingVisible } from "@/state/PricingVisibilityContext";
import { useStrategyStore } from "@/state/strategyStore";

const kindLabel: Record<StrategyNodeData["kind"], string> = {
  source: "Source",
  pipelines: "Obs. Pipelines",
  siem: "SIEM",
  ingest: "Ingest",
  flex_compute: "Flex Compute",
  flex: "Flex",
  flex_starter: "Flex Starter",
  index: "Index",
  archive: "Archive",
  archive_search: "Archive Search",
  group: "Group",
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatMillionLines(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value >= 100) return value.toFixed(0);
  if (value >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function formatEvents(events: number): string {
  if (!Number.isFinite(events) || events <= 0) return "0";
  if (events >= 1e12) return `${(events / 1e12).toFixed(2)}T`;
  if (events >= 1e9) return `${(events / 1e9).toFixed(1)}B`;
  if (events >= 1e6) return `${(events / 1e6).toFixed(1)}M`;
  return events.toLocaleString("en-US");
}

/**
 * Sum events scanned/month across all flex storage children, weighted by retention:
 * a 60-day bucket counts 2× because flex compute scans the full retention window.
 */
function useFlexComputeEvents(): number {
  return useStrategyStore((s) => {
    let sum = 0;
    for (const n of s.nodes) {
      if (n.data?.kind !== "flex") continue;
      const mLines = s.nodeVolumes.get(n.id)?.millionLinesPerMonth ?? 0;
      const days = nearestFlexRetentionDays(
        n.data.flexRetentionDays ?? 30
      );
      sum += mLines * 1e6 * (days / 30);
    }
    return sum;
  });
}

function useNodeMonthlyCost(
  id: string,
  kind: StrategyNodeData["kind"]
): number | null {
  return useStrategyStore((s) => {
    if (kind === "flex") {
      const node = s.nodes.find((n) => n.id === id);
      const mLines = s.nodeVolumes.get(id)?.millionLinesPerMonth ?? 0;
      const days = nearestFlexRetentionDays(
        node?.data?.flexRetentionDays ?? 30
      );
      const rate = resolvePrice("flex_bucket_per_30d", s.pricingOverrides);
      return Math.round(mLines * rate * (days / 30) * 100) / 100;
    }
    const row = s.sheetLineItems.find(
      (r) => r.routeNodeId === id && r.lineKind !== "flex_aggregate"
    );
    if (row && row.monthly != null && Number.isFinite(row.monthly)) {
      return row.monthly;
    }
    return null;
  });
}

export function StrategyNode({ id, data, selected }: NodeProps<FlowStrategyNode>) {
  const d = data as StrategyNodeData;
  const showPricing = usePricingVisible();

  const flexMillionLines = useStrategyStore((s) =>
    d.kind === "flex" || d.kind === "flex_starter"
      ? (s.nodeVolumes.get(id)?.millionLinesPerMonth ?? 0)
      : 0
  );
  const siemTbMo = useStrategyStore((s) =>
    d.kind === "siem" ? (s.nodeVolumes.get(id)?.tbPerMonth ?? 0) : 0
  );
  const archiveSearchTbMo = useStrategyStore((s) =>
    d.kind === "archive_search" ? (s.nodeVolumes.get(id)?.tbPerMonth ?? 0) : 0
  );
  const flexComputeTier = useStrategyStore((s) => s.flexComputeTier);
  const flexComputeEvents = useFlexComputeEvents();
  const monthly = useNodeMonthlyCost(id, d.kind);

  const meta =
    d.kind === "source"
      ? `${d.totalTbPerMonth ?? DEFAULT_TOTAL_TB_PER_MONTH} TB/mo · ${(
          d.millionLinesPerMonth ?? DEFAULT_MILLION_LINES_PER_MONTH
        ).toLocaleString("en-US")}M log lines/mo`
      : d.kind === "index" && d.retentionDays != null
        ? `${d.tierLabel ?? "Std"} · ${d.retentionDays}d`
        : d.kind === "flex" || d.kind === "flex_starter"
          ? `${formatMillionLines(flexMillionLines)}M log lines/mo${
              d.flexRetentionDays != null ? ` · ${d.flexRetentionDays}d retention` : ""
            }`
          : d.kind === "siem"
            ? `${siemTbMo.toFixed(2)} TB/mo`
            : d.kind === "archive_search"
              ? `${archiveSearchTbMo.toFixed(2)} TB scanned/mo`
              : "";

  let capacityFill: React.ReactNode = null;
  if (d.kind === "flex_compute") {
    const cap = tierCapacityForTier(flexComputeTier);
    const upper = cap.upper;
    const fillPct = upper > 0 ? (flexComputeEvents / upper) * 100 : 0;
    const lowerMarkerPct = (cap.lower / upper) * 100;
    const zone =
      flexComputeEvents < cap.lower
        ? "under"
        : flexComputeEvents > cap.upper
          ? "over"
          : "ok";
    capacityFill = (
      <div className="strategy-node__capacity">
        <div className="strategy-node__capacity-row">
          <span className="strategy-node__capacity-tier">
            Auto-tier · {flexComputeTier.toUpperCase()}
          </span>
          <span className="strategy-node__capacity-events">
            {formatEvents(flexComputeEvents)} events/mo
          </span>
        </div>
        <div
          className={`strategy-node__capacity-bar strategy-node__capacity-bar--${zone}`}
          title={`Lower ${formatEvents(cap.lower)} · Upper ${formatEvents(cap.upper)}`}
        >
          <div
            className="strategy-node__capacity-fill"
            style={{ width: `${Math.min(100, Math.max(0, fillPct))}%` }}
          />
          <div
            className="strategy-node__capacity-marker"
            style={{ left: `${Math.min(100, Math.max(0, lowerMarkerPct))}%` }}
          />
        </div>
      </div>
    );
  }

  const orientation = useStrategyStore((s) => s.layoutOrientation);
  const targetPos = orientation === "horizontal" ? Position.Left : Position.Top;
  const sourcePos =
    orientation === "horizontal" ? Position.Right : Position.Bottom;

  return (
    <div
      className={`strategy-node strategy-node--${d.kind} strategy-node--${orientation} ${
        selected ? "strategy-node--selected" : ""
      }`}
    >
      <Handle type="target" position={targetPos} />
      <div className="strategy-node__badge">{kindLabel[d.kind]}</div>
      <div className="strategy-node__title">{d.label}</div>
      {meta ? <div className="strategy-node__meta">{meta}</div> : null}
      {capacityFill}
      {showPricing && monthly != null && monthly > 0 ? (
        <div className="strategy-node__price">{currency.format(monthly)}/mo</div>
      ) : null}
      <Handle type="source" position={sourcePos} />
    </div>
  );
}
