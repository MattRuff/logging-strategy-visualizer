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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  StrategyEdge,
  StrategyNode,
  StrategyNodeData,
} from "@/model/types";
import { useStrategyStore } from "@/state/strategyStore";
import { PctEdge } from "./PctEdge";
import { StrategyNode as StrategyNodeView } from "./StrategyNode";
import { GroupNode } from "./GroupNode";

const nodeTypes = { strategy: StrategyNodeView, group: GroupNode };
const edgeTypes = { pct: PctEdge };

function FlowInner() {
  const nodes = useStrategyStore((s) => s.nodes);
  const edges = useStrategyStore((s) => s.edges);
  const onNodesChange = useStrategyStore((s) => s.onNodesChange);
  const onEdgesChange = useStrategyStore((s) => s.onEdgesChange);
  const connectFromFlow = useStrategyStore((s) => s.connectFromFlow);
  const addStrategyNode = useStrategyStore((s) => s.addStrategyNode);
  const addGroupFromRect = useStrategyStore((s) => s.addGroupFromRect);
  const assignNodeToGroup = useStrategyStore((s) => s.assignNodeToGroup);
  const setSelectedNodeId = useStrategyStore((s) => s.setSelectedNodeId);
  const layoutOrientation = useStrategyStore((s) => s.layoutOrientation);
  const setLayoutOrientation = useStrategyStore(
    (s) => s.setLayoutOrientation
  );
  const runAutoLayout = useStrategyStore((s) => s.autoLayout);
  const [minimapOpen, setMinimapOpen] = useState(true);

  // Group draw mode — store-managed so the Palette button can toggle it too.
  const groupMode = useStrategyStore((s) => s.groupDrawMode);
  const setGroupMode = useStrategyStore((s) => s.setGroupDrawMode);
  const [drawing, setDrawing] = useState<{
    startX: number;
    startY: number;
    curX: number;
    curY: number;
    flowStart: { x: number; y: number };
  } | null>(null);

  const onAutoLayout = useCallback(() => {
    runAutoLayout();
    requestAnimationFrame(() => {
      rfRef.current?.fitView({ padding: 0.15, duration: 250 });
    });
  }, [runAutoLayout]);

  const rfRef = useRef<ReactFlowInstance<StrategyNode, StrategyEdge> | null>(
    null
  );
  const wrapRef = useRef<HTMLDivElement | null>(null);

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

  const orientedNodes = useMemo<StrategyNode[]>(
    () =>
      nodes.map((n) => {
        // Group containers don't have handles or orientation.
        if (n.type === "group") return n;
        return layoutOrientation === "horizontal"
          ? { ...n, sourcePosition: Position.Right, targetPosition: Position.Left }
          : { ...n, sourcePosition: Position.Bottom, targetPosition: Position.Top };
      }),
    [nodes, layoutOrientation]
  );

  // ESC cancels group mode.
  useEffect(() => {
    if (!groupMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setGroupMode(false);
        setDrawing(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [groupMode]);

  const onOverlayMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!groupMode || !rfRef.current || !wrapRef.current) return;
      const rect = wrapRef.current.getBoundingClientRect();
      const flowStart = rfRef.current.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });
      setDrawing({
        startX: e.clientX - rect.left,
        startY: e.clientY - rect.top,
        curX: e.clientX - rect.left,
        curY: e.clientY - rect.top,
        flowStart,
      });
    },
    [groupMode]
  );

  const onOverlayMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!drawing || !wrapRef.current) return;
      const rect = wrapRef.current.getBoundingClientRect();
      setDrawing({
        ...drawing,
        curX: e.clientX - rect.left,
        curY: e.clientY - rect.top,
      });
    },
    [drawing]
  );

  const onOverlayMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!drawing || !rfRef.current) {
        setDrawing(null);
        return;
      }
      const flowEnd = rfRef.current.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });
      const x = Math.min(drawing.flowStart.x, flowEnd.x);
      const y = Math.min(drawing.flowStart.y, flowEnd.y);
      const width = Math.abs(flowEnd.x - drawing.flowStart.x);
      const height = Math.abs(flowEnd.y - drawing.flowStart.y);
      // Ignore tiny accidental clicks
      if (width >= 30 && height >= 30) {
        addGroupFromRect({ x, y, width, height });
      }
      setDrawing(null);
      setGroupMode(false);
    },
    [drawing, addGroupFromRect]
  );

  const drawingBox = useMemo(() => {
    if (!drawing) return null;
    const x = Math.min(drawing.startX, drawing.curX);
    const y = Math.min(drawing.startY, drawing.curY);
    const w = Math.abs(drawing.curX - drawing.startX);
    const h = Math.abs(drawing.curY - drawing.startY);
    return { x, y, w, h };
  }, [drawing]);

  return (
    <div
      ref={wrapRef}
      className={`flow-canvas-inner ${groupMode ? "flow-canvas-inner--group-mode" : ""}`}
      style={{ position: "relative", width: "100%", height: "100%" }}
    >
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
        onNodeDragStop={(_, n) => {
          if (n.type === "group") return;
          // Convert node position to absolute (parents have relative coords).
          let absX = n.position.x;
          let absY = n.position.y;
          if (n.parentId) {
            const p = nodes.find((x) => x.id === n.parentId);
            if (p) {
              absX += p.position.x;
              absY += p.position.y;
            }
          }
          const w = n.measured?.width ?? n.width ?? 0;
          const h = n.measured?.height ?? n.height ?? 0;
          const cx = absX + w / 2;
          const cy = absY + h / 2;
          // Find a group whose bbox contains the dropped center, that isn't the current parent.
          const target = nodes.find((g) => {
            if (g.type !== "group") return false;
            if (g.id === n.parentId) return false;
            const gw =
              (g.style as { width?: number } | undefined)?.width ?? 0;
            const gh =
              (g.style as { height?: number } | undefined)?.height ?? 0;
            return (
              cx >= g.position.x &&
              cx <= g.position.x + gw &&
              cy >= g.position.y &&
              cy <= g.position.y + gh
            );
          });
          if (target) {
            assignNodeToGroup(n.id, target.id, { x: absX, y: absY });
          }
        }}
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
          <button
            type="button"
            onClick={() => {
              setGroupMode(!groupMode);
              setDrawing(null);
            }}
            title={
              groupMode
                ? "Cancel group draw mode (Esc)"
                : "Group: drag to enclose nodes"
            }
            aria-label="Group nodes"
            className={`rotate-toggle__btn ${groupMode ? "rotate-toggle__btn--active" : ""}`}
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
              <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="3 3" />
            </svg>
          </button>
        </Panel>
        {minimapOpen ? (
          <MiniMap zoomable pannable style={{ width: 140, height: 90 }} />
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
          {groupMode
            ? "Drag a rectangle around the nodes you want to group. Esc to cancel."
            : "Drag types from the palette onto the canvas. Connect handles; edit % on edges."}
        </Panel>
      </ReactFlow>

      {groupMode && (
        <div
          className="group-draw-overlay"
          onMouseDown={onOverlayMouseDown}
          onMouseMove={onOverlayMouseMove}
          onMouseUp={onOverlayMouseUp}
          onMouseLeave={() => setDrawing(null)}
        >
          {drawingBox && (
            <div
              className="group-draw-overlay__rect"
              style={{
                left: drawingBox.x,
                top: drawingBox.y,
                width: drawingBox.w,
                height: drawingBox.h,
              }}
            />
          )}
        </div>
      )}
    </div>
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
