import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  DEFAULT_MILLION_LINES_PER_MONTH,
  DEFAULT_TOTAL_TB_PER_MONTH,
} from "@/model/volumeDefaults";
import type {
  StrategyNode as FlowStrategyNode,
  StrategyNodeData,
} from "@/model/types";

const kindLabel: Record<StrategyNodeData["kind"], string> = {
  source: "Source",
  pipelines: "Obs. Pipelines",
  ingest: "Ingest",
  flex: "Flex",
  index: "Index",
  archive: "Archive",
};

export function StrategyNode({ data, selected }: NodeProps<FlowStrategyNode>) {
  const d = data as StrategyNodeData;
  const meta =
    d.kind === "source"
      ? `${d.totalTbPerMonth ?? DEFAULT_TOTAL_TB_PER_MONTH} TB/mo · ${(
          d.millionLinesPerMonth ?? DEFAULT_MILLION_LINES_PER_MONTH
        ).toLocaleString("en-US")}M log lines/mo`
      : d.kind === "index" && d.retentionDays != null
        ? `${d.tierLabel ?? "Std"} · ${d.retentionDays}d`
        : d.kind === "flex" && d.flexRetentionDays != null
          ? `${d.flexRetentionDays}d retention`
          : "";

  return (
    <div
      className={`strategy-node strategy-node--${d.kind} ${
        selected ? "strategy-node--selected" : ""
      }`}
    >
      <Handle type="target" position={Position.Top} />
      <div className="strategy-node__badge">{kindLabel[d.kind]}</div>
      <div className="strategy-node__title">{d.label}</div>
      {meta ? <div className="strategy-node__meta">{meta}</div> : null}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
