import {
  FLEX_RETENTION_DAY_OPTIONS,
  nearestFlexRetentionDays,
} from "@/model/flexRetention";
import type { FlexComputeTier } from "@/model/pricingCatalog";
import {
  DEFAULT_MILLION_LINES_PER_MONTH,
  DEFAULT_TOTAL_TB_PER_MONTH,
} from "@/model/volumeDefaults";
import { useStrategyStore } from "@/state/strategyStore";

const TIERS: { id: FlexComputeTier; label: string }[] = [
  { id: "xs", label: "Extra Small" },
  { id: "sm", label: "Small" },
  { id: "md", label: "Medium" },
  { id: "lg", label: "Large" },
];

export function InspectorPanel() {
  const selectedId = useStrategyStore((s) => s.selectedNodeId);
  const nodes = useStrategyStore((s) => s.nodes);
  const updateNodeData = useStrategyStore((s) => s.updateNodeData);
  const flexComputeTier = useStrategyStore((s) => s.flexComputeTier);
  const setFlexComputeTier = useStrategyStore((s) => s.setFlexComputeTier);

  const node = nodes.find((n) => n.id === selectedId);

  return (
    <div className="inspector">
      <div className="inspector__title">Flex compute (global)</div>
      <label className="inspector__field">
        Tier
        <select
          value={flexComputeTier}
          onChange={(e) =>
            setFlexComputeTier(e.target.value as FlexComputeTier)
          }
        >
          {TIERS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <div className="inspector__title inspector__title--spaced">Node</div>
      {!node ? (
        <p className="inspector__empty">Select a node on the canvas.</p>
      ) : (
        <>
          <label className="inspector__field">
            Label
            <input
              value={node.data.label}
              onChange={(e) =>
                updateNodeData(node.id, { label: e.target.value })
              }
            />
          </label>
          {node.data.kind === "index" ? (
            <>
              <label className="inspector__field">
                Retention (days)
                <select
                  value={node.data.retentionDays ?? 3}
                  onChange={(e) =>
                    updateNodeData(node.id, {
                      retentionDays: Number(e.target.value),
                      label: `Indexed ${e.target.value}d`,
                    })
                  }
                >
                  <option value={3}>3</option>
                  <option value={7}>7</option>
                  <option value={15}>15</option>
                  <option value={30}>30</option>
                </select>
              </label>
              <label className="inspector__field">
                Tier label
                <input
                  value={node.data.tierLabel ?? ""}
                  onChange={(e) =>
                    updateNodeData(node.id, { tierLabel: e.target.value })
                  }
                />
              </label>
            </>
          ) : null}
          {node.data.kind === "flex" ? (
            <label className="inspector__field">
              Flex retention (days)
              <select
                value={
                  FLEX_RETENTION_DAY_OPTIONS.includes(
                    node.data.flexRetentionDays ?? 30
                  )
                    ? (node.data.flexRetentionDays ?? 30)
                    : nearestFlexRetentionDays(node.data.flexRetentionDays ?? 30)
                }
                onChange={(e) =>
                  updateNodeData(node.id, {
                    flexRetentionDays: Number(e.target.value),
                  })
                }
              >
                {FLEX_RETENTION_DAY_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {node.data.kind === "source" ? (
            <>
              <label className="inspector__field">
                Total TB/month
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={
                    node.data.totalTbPerMonth ?? DEFAULT_TOTAL_TB_PER_MONTH
                  }
                  onChange={(e) =>
                    updateNodeData(node.id, {
                      totalTbPerMonth: Math.max(0, Number(e.target.value)),
                    })
                  }
                />
              </label>
              <label className="inspector__field">
                Million log lines, per month
                <input
                  type="text"
                  inputMode="numeric"
                  value={(
                    node.data.millionLinesPerMonth ??
                    DEFAULT_MILLION_LINES_PER_MONTH
                  ).toLocaleString("en-US")}
                  onChange={(e) => {
                    const raw = e.target.value
                      .replace(/,/g, "")
                      .replace(/[^0-9.]/g, "");
                    const n = raw === "" || raw === "." ? 0 : Number(raw);
                    if (Number.isFinite(n) && n >= 0) {
                      updateNodeData(node.id, { millionLinesPerMonth: n });
                    }
                  }}
                />
              </label>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
