import {
  Background,
  Controls,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useMemo, useRef, useState } from "react";
import type {
  StrategyEdge,
  StrategyNode,
  StrategyNodeData,
} from "@/model/types";
import { useStrategyStore } from "@/state/strategyStore";
import { PctEdge } from "./PctEdge";
import { StrategyNode as StrategyNodeView } from "./StrategyNode";

const nodeTypes = { strategy: StrategyNodeView };
const edgeTypes = { pct: PctEdge };

function FlowInner() {
  const nodes = useStrategyStore((s) => s.nodes);
  const edges = useStrategyStore((s) => s.edges);
  const onNodesChange = useStrategyStore((s) => s.onNodesChange);
  const onEdgesChange = useStrategyStore((s) => s.onEdgesChange);
  const connectFromFlow = useStrategyStore((s) => s.connectFromFlow);
  const addStrategyNode = useStrategyStore((s) => s.addStrategyNode);
  const setSelectedNodeId = useStrategyStore((s) => s.setSelectedNodeId);
  const layoutOrientation = useStrategyStore((s) => s.layoutOrientation);
  const setLayoutOrientation = useStrategyStore(
    (s) => s.setLayoutOrientation
  );
  const runAutoLayout = useStrategyStore((s) => s.autoLayout);
  const [minimapOpen, setMinimapOpen] = useState(true);

  const onAutoLayout = useCallback(() => {
    runAutoLayout();
    // Defer fitView so React Flow re-measures nodes at their new positions first.
    requestAnimationFrame(() => {
      rfRef.current?.fitView({ padding: 0.15, duration: 250 });
    });
  }, [runAutoLayout]);

  const rfRef = useRef<ReactFlowInstance<StrategyNode, StrategyEdge> | null>(
    null
  );

  const onConnect = useCallback(
    (c: Connection) => {
      connectFromFlow(c);
    },
    [connectFromFlow]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const kind = e.dataTransfer.getData(
        "application/strategy-node"
      ) as StrategyNodeData["kind"];
      if (!kind || !rfRef.current) return;
      const p = rfRef.current.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });
      addStrategyNode(kind, undefined, p);
    },
    [addStrategyNode]
  );

  const defaultEdgeOptions = useMemo(
    () => ({ type: "pct" as const, animated: true }),
    []
  );

  // React Flow computes edge endpoints from each node's source/targetPosition,
  // not the custom Handle's position prop. Inject the right values per orientation.
  const orientedNodes = useMemo<StrategyNode[]>(
    () =>
      nodes.map((n) =>
        layoutOrientation === "horizontal"
          ? {
              ...n,
              sourcePosition: Position.Right,
              targetPosition: Position.Left,
            }
          : {
              ...n,
              sourcePosition: Position.Bottom,
              targetPosition: Position.Top,
            }
      ),
    [nodes, layoutOrientation]
  );

  return (
    <ReactFlow
      nodes={orientedNodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onInit={(i) => {
        rfRef.current = i;
      }}
      onDrop={onDrop}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onNodeClick={(_, n) => setSelectedNodeId(n.id)}
      onPaneClick={() => setSelectedNodeId(null)}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      defaultEdgeOptions={defaultEdgeOptions}
      fitView
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={16} />
      <Controls />
      <Panel position="bottom-left" className="rotate-toggle">
        <button
          type="button"
          onClick={onAutoLayout}
          title="Auto-layout the graph"
          aria-label="Auto-layout"
          className="rotate-toggle__btn rotate-toggle__btn--auto"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 3v18" />
            <path d="M5 8h6a3 3 0 0 1 3 3v2a3 3 0 0 0 3 3h2" />
            <path d="M14 13l3 3-3 3" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() =>
            setLayoutOrientation(
              layoutOrientation === "horizontal" ? "vertical" : "horizontal"
            )
          }
          title={`Rotate to ${
            layoutOrientation === "horizontal" ? "vertical" : "horizontal"
          } layout`}
          aria-label="Rotate layout"
          className="rotate-toggle__btn"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
      </Panel>
      {minimapOpen ? (
        <MiniMap
          zoomable
          pannable
          style={{ width: 140, height: 90 }}
        />
      ) : null}
      <Panel
        position="bottom-right"
        className={`minimap-toggle ${
          minimapOpen ? "minimap-toggle--open" : "minimap-toggle--closed"
        }`}
      >
        <button
          type="button"
          onClick={() => setMinimapOpen((o) => !o)}
          title={minimapOpen ? "Hide minimap" : "Show minimap"}
        >
          {minimapOpen ? "−" : "Map"}
        </button>
      </Panel>
      <Panel position="top-left" className="flow-hint">
        Drag types from the palette onto the canvas. Connect handles; edit %
        on edges.
      </Panel>
    </ReactFlow>
  );
}

export function FlowCanvas() {
  return (
    <div className="flow-canvas-wrap">
      <ReactFlowProvider>
        <FlowInner />
      </ReactFlowProvider>
    </div>
  );
}
