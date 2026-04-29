import { useState } from "react";
import { NodeResizer, type NodeProps } from "@xyflow/react";
import type { StrategyNode } from "@/model/types";
import { useStrategyStore } from "@/state/strategyStore";

/**
 * Group container — a translucent rounded rectangle sized via node.style.width / height.
 * Children are normal nodes whose `parentId` points at this node; React Flow positions
 * them relative to the group and moves them when the group is dragged.
 */
export function GroupNode({ id, data, selected }: NodeProps<StrategyNode>) {
  const updateNodeData = useStrategyStore((s) => s.updateNodeData);
  const onNodesChange = useStrategyStore((s) => s.onNodesChange);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label ?? "Group");

  const commitLabel = () => {
    const next = draft.trim() || "Group";
    if (next !== data.label) updateNodeData(id, { label: next });
    setEditing(false);
  };

  const color = data.groupColor ?? "var(--dd-purple)";
  return (
    <div
      className={`group-node ${selected ? "group-node--selected" : ""}`}
      style={
        {
          // Drive borders/backgrounds via the per-group color.
          "--group-color": color,
        } as React.CSSProperties
      }
    >
      <NodeResizer
        isVisible={selected}
        minWidth={120}
        minHeight={80}
        lineStyle={{ borderColor: color }}
        handleStyle={{
          width: 8,
          height: 8,
          background: color,
          borderColor: "#fff",
        }}
      />
      <div className="group-node__header nodrag">
        <span
          className="group-node__color-swatch"
          title="Pick a group color"
          aria-label="Pick a group color"
        >
          <input
            type="color"
            className="group-node__color-input"
            value={typeof color === "string" && color.startsWith("#") ? color : "#632ca6"}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => updateNodeData(id, { groupColor: e.target.value })}
          />
        </span>
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                setDraft(data.label ?? "Group");
                setEditing(false);
              }
            }}
            className="group-node__name-input"
          />
        ) : (
          <button
            type="button"
            className="group-node__name"
            title="Rename group"
            onClick={() => {
              setDraft(data.label ?? "Group");
              setEditing(true);
            }}
          >
            {data.label || "Group"}
          </button>
        )}
        <button
          type="button"
          className="group-node__delete"
          title="Delete group (children stay)"
          aria-label="Delete group"
          onClick={(e) => {
            e.stopPropagation();
            onNodesChange([{ type: "remove", id }]);
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
