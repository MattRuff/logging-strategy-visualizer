import {
  FLEX_RETENTION_DAY_OPTIONS,
  nearestFlexRetentionDays,
} from "@/model/flexRetention";
import {
  DEFAULT_MILLION_LINES_PER_MONTH,
  DEFAULT_TOTAL_TB_PER_MONTH,
} from "@/model/volumeDefaults";
import { useStrategyStore } from "@/state/strategyStore";

export function InspectorPanel() {
  const selectedId = useStrategyStore((s) => s.selectedNodeId);
  const nodes = useStrategyStore((s) => s.nodes);
  const updateNodeData = useStrategyStore((s) => s.updateNodeData);
  const setOpUnitsOverride = useStrategyStore((s) => s.setOpUnitsOverride);
  const pipelinesTbMo = useStrategyStore((s) =>
    selectedId ? (s.nodeVolumes.get(selectedId)?.tbPerMonth ?? 0) : 0
  );

  const node = nodes.find((n) => n.id === selectedId);
  const opGuidance = Math.max(0, Math.ceil(pipelinesTbMo / 30));
  const opOverride = node?.data.kind === "pipelines"
    ? node.data.opUnitsOverride
    : undefined;
  const opEffective = opOverride != null && Number.isFinite(opOverride)
    ? Math.max(0, Math.ceil(opOverride))
    : opGuidance;

  return (
    <div className="inspector">
      <div className="inspector__title">Node</div>
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
          {node.data.kind === "pipelines" ? (
            <label className="inspector__field">
              vCPUs (1 vCPU ≈ 30 TB/mo)
              <input
                type="number"
                min={0}
                step={1}
                value={opEffective}
                key={`${node.id}-op-${opOverride ?? "auto"}-${opGuidance}`}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    setOpUnitsOverride(node.id, undefined);
                    return;
                  }
                  const n = Number(raw);
                  if (Number.isFinite(n)) setOpUnitsOverride(node.id, n);
                }}
              />
              <span style={{ fontSize: 11, color: "var(--dd-text-muted)", fontWeight: 400 }}>
                {opOverride != null
                  ? `Overridden — auto would be ${opGuidance} (${pipelinesTbMo.toFixed(1)} TB/mo)`
                  : `Auto from ${pipelinesTbMo.toFixed(1)} TB/mo`}
              </span>
              {opOverride != null ? (
                <button
                  type="button"
                  onClick={() => setOpUnitsOverride(node.id, undefined)}
                  style={{
                    alignSelf: "flex-start",
                    marginTop: 4,
                    fontSize: 11,
                    padding: "3px 8px",
                    border: "1px solid var(--dd-border)",
                    borderRadius: "var(--dd-radius)",
                    background: "var(--dd-bg-subtle)",
                    color: "var(--dd-text)",
                    cursor: "pointer",
                  }}
                >
                  Clear override
                </button>
              ) : null}
            </label>
          ) : null}
          {node.data.kind === "flex" || node.data.kind === "flex_starter" ? (
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
          {node.data.kind === "third_party" ? (
            <>
              <label className="inspector__field">
                Unit
                <select
                  value={node.data.thirdPartyUnit ?? "GB"}
                  onChange={(e) =>
                    updateNodeData(node.id, {
                      thirdPartyUnit: e.target.value as "GB" | "MM",
                    })
                  }
                >
                  <option value="GB">GB / month</option>
                  <option value="MM">Million log lines / month</option>
                </select>
              </label>
              <label className="inspector__field">
                Quantity / month (
                {node.data.thirdPartyUnit === "MM" ? "MM lines" : "GB"})
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={node.data.thirdPartyQty ?? 0}
                  onChange={(e) =>
                    updateNodeData(node.id, {
                      thirdPartyQty: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                />
              </label>
              <label className="inspector__field">
                Unit cost ($ per{" "}
                {node.data.thirdPartyUnit === "MM" ? "MM lines" : "GB"})
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={node.data.thirdPartyUnitCost ?? 0}
                  onChange={(e) =>
                    updateNodeData(node.id, {
                      thirdPartyUnitCost: Math.max(
                        0,
                        Number(e.target.value) || 0
                      ),
                    })
                  }
                />
              </label>
            </>
          ) : null}
          {node.data.kind === "source" ? (
            <>
              <label className="inspector__field">
                Total TB/month
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={
                    node.data.totalTbPerMonth ?? DEFAULT_TOTAL_TB_PER_MONTH
                  }
                  onChange={(e) =>
                    updateNodeData(node.id, {
                      totalTbPerMonth: Math.max(
                        0,
                        Math.round(Number(e.target.value))
                      ),
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
