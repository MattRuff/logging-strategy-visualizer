import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";
import { useStrategyStore } from "@/state/strategyStore";

/** % of parent volume routed along this edge into the downstream node */
export function PctEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
}: EdgeProps) {
  const pct = useStrategyStore((s) => {
    const e = s.edges.find((x) => x.id === id);
    return e?.data?.pct ?? 0;
  });
  const updateEdgePct = useStrategyStore((s) => s.updateEdgePct);

  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });

  return (
    <>
      <BaseEdge path={path} markerEnd={markerEnd} />
      <EdgeLabelRenderer>
        <div
          className="pct-edge-label nodrag nopan"
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
        >
          <label className="pct-edge-label__inner">
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              title="% of logs entering the downstream node via this link"
              value={Number.isFinite(pct) ? pct : 0}
              onChange={(ev) =>
                updateEdgePct(id, Number(ev.target.value))
              }
            />
            <span className="pct-edge-label__suffix">%</span>
          </label>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
