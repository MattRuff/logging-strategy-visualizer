import {
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useMemo, useRef } from "react";
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

  return (
    <ReactFlow
      nodes={nodes}
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
      <MiniMap zoomable pannable />
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
