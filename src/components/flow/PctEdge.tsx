import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";
import { useState } from "react";
import type { NodeKind } from "@/model/types";
import { useStrategyStore } from "@/state/strategyStore";

/** Width fallback for browsers without `field-sizing: content` (Firefox, older Safari). */
function sizeFor(text: string): number {
  return Math.max(2, text.length);
}

/** For archive leaves we care about GB/TB stored; for everything else we track events. */
function unitForTargetKind(kind: NodeKind | undefined): {
  label: string;
  kind: "mlines" | "tb";
} {
  if (kind === "archive") return { label: "TB/mo", kind: "tb" };
  return { label: "M lines/mo", kind: "mlines" };
}

function formatVolume(value: number, unit: "mlines" | "tb"): string {
  if (!Number.isFinite(value)) return "0";
  if (unit === "mlines") {
    if (value === 0) return "0";
    if (value >= 100) return value.toFixed(0);
    if (value >= 10) return value.toFixed(1);
    return value.toFixed(2);
  }
  if (value === 0) return "0";
  if (value >= 10) return value.toFixed(2);
  return value.toFixed(3);
}

/** % of parent volume routed along this edge into the downstream node */
export function PctEdge({
  id,
  source,
  target,
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
  const targetKind = useStrategyStore(
    (s) => s.nodes.find((n) => n.id === target)?.data.kind
  );
  const sourceVolume = useStrategyStore((s) => {
    const v = s.nodeVolumes.get(source);
    if (!v) return 0;
    return unitForTargetKind(
      s.nodes.find((n) => n.id === target)?.data.kind
    ).kind === "mlines"
      ? v.millionLinesPerMonth
      : v.tbPerMonth;
  });
  const updateEdgePct = useStrategyStore((s) => s.updateEdgePct);
  const onEdgesChange = useStrategyStore((s) => s.onEdgesChange);

  const unit = unitForTargetKind(targetKind);
  const volume = sourceVolume * (Math.max(0, Math.min(100, pct)) / 100);
  const volumeDisabled = !(sourceVolume > 0);

  const onVolumeChange = (nextVolume: number) => {
    if (!Number.isFinite(nextVolume) || sourceVolume <= 0) return;
    const nextPct = (nextVolume / sourceVolume) * 100;
    updateEdgePct(id, Math.round(nextPct * 1000) / 1000);
  };

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
          <PctInput
            pct={pct}
            onCommit={(n) => updateEdgePct(id, n)}
          />
          <VolumeInput
            key={`${id}-${unit.kind}-${volume}`}
            unit={unit}
            volume={volume}
            disabled={volumeDisabled}
            onCommit={onVolumeChange}
          />
          <button
            type="button"
            className="pct-edge-label__delete"
            title="Delete this connection"
            aria-label="Delete connection"
            onClick={(e) => {
              e.stopPropagation();
              onEdgesChange([{ type: "remove", id }]);
            }}
          >
            ×
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

function PctInput({
  pct,
  onCommit,
}: {
  pct: number;
  onCommit: (n: number) => void;
}) {
  const displayed = Number.isFinite(pct) ? String(pct) : "0";
  const [draft, setDraft] = useState(displayed);
  const value = draft;
  return (
    <label className="pct-edge-label__inner">
      <input
        type="number"
        min={0}
        max={100}
        step={0.1}
        title="% of logs entering the downstream node via this link"
        size={sizeFor(value)}
        value={value}
        onChange={(ev) => {
          setDraft(ev.target.value);
          const n = Number(ev.target.value);
          if (Number.isFinite(n)) onCommit(n);
        }}
      />
      <span className="pct-edge-label__suffix">%</span>
    </label>
  );
}

function VolumeInput({
  unit,
  volume,
  disabled,
  onCommit,
}: {
  unit: { label: string; kind: "mlines" | "tb" };
  volume: number;
  disabled: boolean;
  onCommit: (n: number) => void;
}) {
  const initial = formatVolume(volume, unit.kind);
  const [draft, setDraft] = useState(initial);
  return (
    <label
      className={`pct-edge-label__inner pct-edge-label__inner--volume ${
        disabled ? "pct-edge-label__inner--disabled" : ""
      }`}
      title={
        disabled
          ? "Set a source volume upstream to edit this number"
          : `Logs flowing through this edge (${unit.label})`
      }
    >
      <input
        type="number"
        min={0}
        step={unit.kind === "tb" ? 0.01 : 0.1}
        disabled={disabled}
        size={sizeFor(draft)}
        value={draft}
        onChange={(ev) => setDraft(ev.target.value)}
        onBlur={(ev) => {
          const n = Number(ev.target.value);
          if (Number.isFinite(n)) onCommit(n);
        }}
        onKeyDown={(ev) => {
          if (ev.key === "Enter") {
            (ev.target as HTMLInputElement).blur();
          }
        }}
      />
      <span className="pct-edge-label__suffix">{unit.label}</span>
    </label>
  );
}
