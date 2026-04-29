import {
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import { create } from "zustand";
import { autoLayout } from "@/model/autoLayout";
import {
  createInitialGraph,
  rotateNodePositions,
  type LayoutOrientation,
} from "@/model/initialGraph";
import {
  computeNodeVolumes,
  computeSplitSums,
  type NodeVolume,
  pathFractionToNode,
  primarySourceId,
} from "@/model/graphMath";
import {
  pickFlexComputeTier,
  type FlexComputeTier,
  type PricingKey,
} from "@/model/pricingCatalog";
import { nearestFlexRetentionDays } from "@/model/flexRetention";
import { enforceFlexComputeInvariant } from "@/model/flexInvariant";
import { buildSheetLineItems } from "@/model/sheetLineItems";
import {
  DEFAULT_MILLION_LINES_PER_MONTH,
  DEFAULT_TOTAL_TB_PER_MONTH,
} from "@/model/volumeDefaults";
import type {
  LineItem,
  StrategyEdge,
  StrategyNode,
  StrategyNodeData,
} from "@/model/types";

/** Total events scanned/month across flex storage children, retention-weighted. */
function flexEventsFromVolumes(
  nodes: StrategyNode[],
  volumes: Map<string, NodeVolume>
): number {
  let sum = 0;
  for (const n of nodes) {
    if (n.data?.kind !== "flex") continue;
    const mLines = volumes.get(n.id)?.millionLinesPerMonth ?? 0;
    const days = nearestFlexRetentionDays(n.data.flexRetentionDays ?? 30);
    sum += mLines * 1e6 * (days / 30);
  }
  return sum;
}

function rebuildDerived(
  s: Pick<StrategyStore, "nodes" | "edges" | "pricingOverrides">
): {
  sheetLineItems: LineItem[];
  nodeVolumes: Map<string, NodeVolume>;
  flexComputeTier: FlexComputeTier;
} {
  const nodeVolumes = computeNodeVolumes(s.nodes, s.edges);
  const events = flexEventsFromVolumes(s.nodes, nodeVolumes);
  const flexComputeTier = pickFlexComputeTier(events);
  const sheetLineItems = buildSheetLineItems({
    nodes: s.nodes,
    edges: s.edges,
    pricingOverrides: s.pricingOverrides,
    flexComputeTier,
    nodeVolumes,
  });
  return { sheetLineItems, nodeVolumes, flexComputeTier };
}

/** Undoable subset of store state. flexComputeTier is auto-derived, so it's not snapshotted. */
interface HistorySnapshot {
  nodes: StrategyNode[];
  edges: StrategyEdge[];
  pricingOverrides: Partial<Record<PricingKey, number>>;
}

/** Keep history bounded so memory stays flat during long sessions. */
const HISTORY_LIMIT = 50;

/** Distinct, distinguishable hues for new groups. Cycles after ~8. */
export const GROUP_COLORS = [
  "#632ca6", // dd-purple
  "#3399ff", // dd-blue
  "#00b4a1", // dd-teal
  "#e17840", // dd-orange
  "#9166d6",
  "#39c5d9",
  "#e5a13e",
  "#7b4fc7",
];

function snapshotFrom(s: HistorySnapshot): HistorySnapshot {
  return {
    nodes: s.nodes,
    edges: s.edges,
    pricingOverrides: s.pricingOverrides,
  };
}

export type { LayoutOrientation };

export interface StrategyStore {
  nodes: StrategyNode[];
  edges: StrategyEdge[];
  sheetLineItems: LineItem[];
  /** Cached tb/month + million-lines/month per node; rebuilt alongside sheet items. */
  nodeVolumes: Map<string, NodeVolume>;
  pricingOverrides: Partial<Record<PricingKey, number>>;
  flexComputeTier: FlexComputeTier;
  layoutOrientation: LayoutOrientation;
  sheetConflicts: string[];
  selectedNodeId: string | null;

  past: HistorySnapshot[];
  /** Captured on drag start; pushed to `past` on drag end so each drag is one entry. */
  _pendingDragStart: HistorySnapshot | null;

  onNodesChange: (changes: NodeChange<StrategyNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<StrategyEdge>[]) => void;

  updateEdgePct: (edgeId: string, pct: number) => void;
  addStrategyNode: (
    kind: StrategyNodeData["kind"],
    label?: string,
    position?: { x: number; y: number }
  ) => void;
  connectNodes: (source: string, target: string, pct?: number) => void;
  connectFromFlow: (c: Connection) => void;

  updateNodeData: (
    id: string,
    partial: Partial<StrategyNodeData>
  ) => void;

  /** Create a group node from a flow-coordinate rect; reparents enclosed nodes to it. */
  addGroupFromRect: (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;

  /** When true, dragging on the canvas creates a new group rectangle. */
  groupDrawMode: boolean;
  setGroupDrawMode: (on: boolean) => void;

  /** Reparent a node into the given group at an absolute flow-coord position. */
  assignNodeToGroup: (
    nodeId: string,
    groupId: string,
    absolutePos: { x: number; y: number }
  ) => void;

  setPricingOverride: (key: PricingKey, value: number | undefined) => void;
  resetPricingDefaults: () => void;
  setLayoutOrientation: (o: LayoutOrientation) => void;
  autoLayout: () => void;

  applyRoutePctFromSheet: (routeNodeId: string, pctOfTotalLeaf: number) => void;

  newScenario: () => void;

  setSelectedNodeId: (id: string | null) => void;

  pushHistory: () => void;
  undo: () => void;

  getSplitValidations: () => ReturnType<typeof computeSplitSums>;
  getGrandTotals: () => { monthly: number; annual: number };
}

let idCounter = 0;
export function genId(prefix: string) {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
}

/**
 * Bump the id counter above the largest numeric suffix seen in the given graph so
 * newly minted `n_*`/`e_*` IDs cannot collide with imported or freshly-built ones.
 */
export function reseedIdCounter(
  nodes: StrategyNode[],
  edges: StrategyEdge[]
): void {
  let max = 0;
  const scan = (id: string) => {
    const m = /_(\d+)$/.exec(id);
    if (!m) return;
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > max) max = n;
  };
  for (const n of nodes) scan(n.id);
  for (const e of edges) scan(e.id);
  if (max > idCounter) idCounter = max;
}

export const useStrategyStore = create<StrategyStore>((set, get) => {
  const initial = createInitialGraph();
  reseedIdCounter(initial.nodes, initial.edges);

  const baseState = {
    nodes: initial.nodes,
    edges: initial.edges,
    pricingOverrides: {} as Partial<Record<PricingKey, number>>,
    layoutOrientation: "horizontal" as LayoutOrientation,
    sheetConflicts: [] as string[],
    selectedNodeId: null as string | null,
    past: [] as HistorySnapshot[],
    _pendingDragStart: null as HistorySnapshot | null,
    groupDrawMode: false,
  };

  const { sheetLineItems, nodeVolumes, flexComputeTier } = rebuildDerived({
    ...baseState,
    nodes: initial.nodes,
    edges: initial.edges,
  });

  const pushHistoryInternal = () => {
    const s = get();
    const snap = snapshotFrom(s);
    const next = [...s.past, snap];
    if (next.length > HISTORY_LIMIT) next.splice(0, next.length - HISTORY_LIMIT);
    set({ past: next });
  };

  /**
   * Track the last edge-pct edit so typing e.g. "12.5" collapses to a single undo
   * step instead of three. Lives outside the store so it does not force re-renders.
   */
  const EDGE_PCT_COALESCE_MS = 500;
  let lastEdgePctEdit: { edgeId: string; at: number } | null = null;

  return {
    ...baseState,
    sheetLineItems,
    nodeVolumes,
    flexComputeTier,

    onNodesChange: (changes) => {
      const s = get();
      let pendingDragStart = s._pendingDragStart;
      let pushedDragEnd = false;
      const newPast = [...s.past];

      for (const ch of changes) {
        if (ch.type === "position") {
          if (ch.dragging === true && pendingDragStart === null) {
            pendingDragStart = snapshotFrom(s);
          } else if (
            ch.dragging === false &&
            pendingDragStart !== null &&
            !pushedDragEnd
          ) {
            newPast.push(pendingDragStart);
            if (newPast.length > HISTORY_LIMIT) {
              newPast.splice(0, newPast.length - HISTORY_LIMIT);
            }
            pendingDragStart = null;
            pushedDragEnd = true;
          }
        } else if (ch.type === "remove") {
          newPast.push(snapshotFrom(s));
          if (newPast.length > HISTORY_LIMIT) {
            newPast.splice(0, newPast.length - HISTORY_LIMIT);
          }
        }
      }

      set((state) => {
        // Before applying remove changes for group nodes, lift their children
        // back to absolute positions so they don't end up orphaned at relative coords.
        const removingGroupIds = new Set<string>();
        for (const ch of changes) {
          if (ch.type === "remove") {
            const target = state.nodes.find((n) => n.id === ch.id);
            if (target?.type === "group") removingGroupIds.add(ch.id);
          }
        }
        const groupPosById = new Map(
          state.nodes
            .filter((n) => removingGroupIds.has(n.id))
            .map((g) => [g.id, g.position])
        );
        const liftedNodes = state.nodes.map((n) => {
          if (!n.parentId || !groupPosById.has(n.parentId)) return n;
          const gp = groupPosById.get(n.parentId)!;
          // Reabsolutize and drop parent linkage.
          const { parentId: _p, extent: _e, ...rest } = n;
          return {
            ...rest,
            position: { x: n.position.x + gp.x, y: n.position.y + gp.y },
          };
        });
        const nextNodes = applyNodeChanges(changes, liftedNodes);
        const enforced = enforceFlexComputeInvariant(nextNodes, state.edges, genId);
        return {
          nodes: enforced.nodes,
          edges: enforced.edges,
          past: newPast,
          _pendingDragStart: pendingDragStart,
        };
      });

      // Only structural changes (add/remove/replace) can change cost cells or
      // volume flows; skip rebuild for pure drag/select/dimension events.
      const structural = changes.some(
        (c) =>
          c.type === "add" || c.type === "remove" || c.type === "replace"
      );
      if (structural) {
        set(rebuildDerived(get()));
      }
    },

    onEdgesChange: (changes) => {
      const shouldSnapshot = changes.some((c) => c.type === "remove");
      if (shouldSnapshot) pushHistoryInternal();
      set((state) => {
        const nextEdges = applyEdgeChanges(changes, state.edges);
        const enforced = enforceFlexComputeInvariant(state.nodes, nextEdges, genId);
        return { nodes: enforced.nodes, edges: enforced.edges };
      });
      const structural = changes.some(
        (c) =>
          c.type === "add" || c.type === "remove" || c.type === "replace"
      );
      if (structural) {
        set(rebuildDerived(get()));
      }
    },

    updateEdgePct: (edgeId, pct) => {
      const now = Date.now();
      const recent =
        lastEdgePctEdit?.edgeId === edgeId &&
        now - lastEdgePctEdit.at < EDGE_PCT_COALESCE_MS;
      if (!recent) pushHistoryInternal();
      lastEdgePctEdit = { edgeId, at: now };
      const clamped = Math.max(0, Math.min(100, pct));
      set((state) => ({
        edges: state.edges.map((e) =>
          e.id === edgeId
            ? { ...e, data: { ...e.data, pct: clamped } }
            : e
        ),
      }));
      set(rebuildDerived(get()));
    },

    addStrategyNode: (kind, label, position) => {
      pushHistoryInternal();
      const id = genId("n");
      const defaultLabel =
        label ??
        ({
          source: "Source",
          pipelines: "Observability Pipelines",
          siem: "SIEM",
          ingest: "Ingest",
          flex_compute: "Flex Compute",
          flex: "Flex logs",
          flex_starter: "Flex Logs Starter",
          index: "Indexed logs",
          archive: "Archive",
          archive_search: "Archive Search",
          group: "Group",
        }[kind] as string);

      const data: StrategyNodeData = {
        kind,
        label: defaultLabel,
        totalTbPerMonth:
          kind === "source" ? DEFAULT_TOTAL_TB_PER_MONTH : undefined,
        millionLinesPerMonth:
          kind === "source" ? DEFAULT_MILLION_LINES_PER_MONTH : undefined,
        retentionDays: kind === "index" ? 3 : undefined,
        flexRetentionDays:
          kind === "flex" || kind === "flex_starter" ? 30 : undefined,
        tierLabel: kind === "index" ? "Standard" : undefined,
      };

      const pos = position ?? {
        x: 100 + Math.random() * 400,
        y: 200 + Math.random() * 200,
      };

      set((state) => {
        // If the drop position falls inside an existing group, adopt the new
        // node as a child of that group with relative coordinates.
        const containingGroup = state.nodes.find((n) => {
          if (n.type !== "group") return false;
          const w = (n.style as { width?: number } | undefined)?.width ?? 0;
          const h = (n.style as { height?: number } | undefined)?.height ?? 0;
          return (
            pos.x >= n.position.x &&
            pos.x <= n.position.x + w &&
            pos.y >= n.position.y &&
            pos.y <= n.position.y + h
          );
        });
        const newNode: StrategyNode = containingGroup
          ? {
              id,
              type: "strategy",
              parentId: containingGroup.id,
              extent: "parent" as const,
              position: {
                x: pos.x - containingGroup.position.x,
                y: pos.y - containingGroup.position.y,
              },
              data,
            }
          : {
              id,
              type: "strategy",
              position: pos,
              data,
            };
        const nextNodes: StrategyNode[] = containingGroup
          ? // Insert AFTER the group so React Flow's parent-before-child rule holds.
            (() => {
              const idx = state.nodes.findIndex((n) => n.id === containingGroup.id);
              return [
                ...state.nodes.slice(0, idx + 1),
                newNode,
                ...state.nodes.slice(idx + 1),
              ];
            })()
          : [...state.nodes, newNode];
        const enforced = enforceFlexComputeInvariant(nextNodes, state.edges, genId);
        return { nodes: enforced.nodes, edges: enforced.edges };
      });
      set(rebuildDerived(get()));
    },

    connectNodes: (source, target, pct = 50) => {
      pushHistoryInternal();
      const id = genId("e");
      set((state) => ({
        edges: [
          ...state.edges,
          {
            id,
            source,
            target,
            type: "pct",
            data: { pct },
          },
        ],
      }));
      set(rebuildDerived(get()));
    },

    connectFromFlow: (c) => {
      if (!c.source || !c.target) return;
      const state = get();
      const dup = state.edges.some(
        (e) => e.source === c.source && e.target === c.target
      );
      if (dup) return;
      pushHistoryInternal();
      const id = genId("e");
      set((s) => ({
        edges: [
          ...s.edges,
          {
            id,
            source: c.source as string,
            target: c.target as string,
            type: "pct",
            data: { pct: 50 },
          },
        ],
      }));
      set(rebuildDerived(get()));
    },

    updateNodeData: (id, partial) => {
      pushHistoryInternal();
      set((state) => ({
        nodes: state.nodes.map((n) =>
          n.id === id
            ? { ...n, data: { ...n.data, ...partial } as StrategyNodeData }
            : n
        ),
      }));
      set(rebuildDerived(get()));
    },

    setGroupDrawMode: (on) => set({ groupDrawMode: on }),

    assignNodeToGroup: (nodeId, groupId, absolutePos) => {
      const s = get();
      const node = s.nodes.find((n) => n.id === nodeId);
      const group = s.nodes.find((n) => n.id === groupId && n.type === "group");
      if (!node || !group) return;
      if (node.parentId === groupId) return;
      pushHistoryInternal();
      // Remove the child, then re-insert it AFTER the group node so React Flow's
      // parent-before-child ordering invariant holds.
      const updatedChild: StrategyNode = {
        ...node,
        parentId: groupId,
        extent: "parent" as const,
        position: {
          x: absolutePos.x - group.position.x,
          y: absolutePos.y - group.position.y,
        },
      };
      set((state) => {
        const without = state.nodes.filter((n) => n.id !== nodeId);
        const groupIdx = without.findIndex((n) => n.id === groupId);
        const next = [
          ...without.slice(0, groupIdx + 1),
          updatedChild,
          ...without.slice(groupIdx + 1),
        ];
        return { nodes: next };
      });
      set(rebuildDerived(get()));
    },

    addGroupFromRect: (rect) => {
      // Normalize negative drags
      const x = Math.min(rect.x, rect.x + rect.width);
      const y = Math.min(rect.y, rect.y + rect.height);
      const w = Math.max(40, Math.abs(rect.width));
      const h = Math.max(40, Math.abs(rect.height));

      pushHistoryInternal();
      const id = genId("g");
      const existingGroupCount = get().nodes.filter(
        (n) => n.type === "group"
      ).length;
      const color = GROUP_COLORS[existingGroupCount % GROUP_COLORS.length];
      const groupNode: StrategyNode = {
        id,
        type: "group",
        position: { x, y },
        // React Flow reads width/height from `style` for group containers.
        style: { width: w, height: h },
        data: {
          kind: "group" as const,
          label: "Group",
          groupColor: color,
        } as StrategyNodeData,
        // Render behind children
        zIndex: -1,
        selectable: true,
        draggable: true,
      };

      set((state) => {
        const reparented = state.nodes.map((n) => {
          // Skip nodes already inside another parent — don't double-nest.
          if (n.parentId) return n;
          if (n.type === "group") return n;
          // Use node center for hit testing; fall back to position-only when size unknown.
          const nx = n.position.x;
          const ny = n.position.y;
          const nw = (n.measured?.width ?? n.width ?? 0) || 0;
          const nh = (n.measured?.height ?? n.height ?? 0) || 0;
          const cx = nx + nw / 2;
          const cy = ny + nh / 2;
          const inside = cx >= x && cx <= x + w && cy >= y && cy <= y + h;
          if (!inside) return n;
          return {
            ...n,
            parentId: id,
            extent: "parent" as const,
            // Coordinates become relative to parent.
            position: { x: nx - x, y: ny - y },
          };
        });
        // Group must come BEFORE its children in the array (React Flow rule).
        return { nodes: [groupNode, ...reparented] };
      });
      set(rebuildDerived(get()));
    },

    setPricingOverride: (key, value) => {
      pushHistoryInternal();
      set((state) => {
        const next = { ...state.pricingOverrides };
        if (value === undefined || Number.isNaN(value)) {
          delete next[key];
        } else {
          next[key] = value;
        }
        return { pricingOverrides: next };
      });
      set(rebuildDerived(get()));
    },

    resetPricingDefaults: () => {
      pushHistoryInternal();
      set({ pricingOverrides: {} });
      set(rebuildDerived(get()));
    },

    setLayoutOrientation: (o) => {
      const s = get();
      if (s.layoutOrientation === o) return;
      pushHistoryInternal();
      set({
        layoutOrientation: o,
        nodes: rotateNodePositions(s.nodes),
      });
    },

    autoLayout: () => {
      const s = get();
      if (s.nodes.length === 0) return;
      pushHistoryInternal();
      set({
        nodes: autoLayout(s.nodes, s.edges, s.layoutOrientation),
      });
    },

    applyRoutePctFromSheet: (routeNodeId, pctOfTotalLeaf) => {
      const state = get();
      const rootId = primarySourceId(state.nodes);
      if (!rootId) {
        set({
          sheetConflicts: [
            "No source node on the graph; cannot set %.",
          ],
        });
        return;
      }
      const path = pathFractionToNode(
        rootId,
        routeNodeId,
        state.nodes,
        state.edges
      );
      if (!path || path.path.length === 0) {
        set({
          sheetConflicts: [
            `No path from primary source to node ${routeNodeId}; cannot set %.`,
          ],
        });
        return;
      }
      const targetFraction = Math.max(0, Math.min(100, pctOfTotalLeaf)) / 100;
      const edges = state.edges;
      const lastEdgeId = path.path[path.path.length - 1];
      const lastEdge = edges.find((x) => x.id === lastEdgeId);
      const oldP = lastEdge?.data?.pct ?? 0;
      const full = path.fraction;
      if (full <= 0 || oldP <= 0) {
        set({
          sheetConflicts: ["Cannot adjust %: invalid path or zero edge."],
        });
        return;
      }
      pushHistoryInternal();
      const prev = full / (oldP / 100);
      const newP = (targetFraction / prev) * 100;
      const clampedLast = Math.max(0, Math.min(100, newP));

      set({
        edges: edges.map((e) =>
          e.id === lastEdgeId
            ? {
                ...e,
                data: {
                  ...e.data,
                  pct: Math.round(clampedLast * 1000) / 1000,
                },
              }
            : e
        ),
        sheetConflicts: [],
      });
      set(rebuildDerived(get()));
    },

    newScenario: () => {
      pushHistoryInternal();
      const g = createInitialGraph(get().layoutOrientation);
      reseedIdCounter(g.nodes, g.edges);
      set({
        nodes: g.nodes,
        edges: g.edges,
        pricingOverrides: {},
        sheetConflicts: [],
        selectedNodeId: null,
      });
      set(rebuildDerived(get()));
    },

    setSelectedNodeId: (id) => set({ selectedNodeId: id }),

    pushHistory: () => pushHistoryInternal(),

    undo: () => {
      const s = get();
      if (s.past.length === 0) return;
      const prev = s.past[s.past.length - 1];
      const nextPast = s.past.slice(0, -1);
      // Reset the coalesce window so the next edit is always a fresh history entry.
      lastEdgePctEdit = null;
      set({
        past: nextPast,
        _pendingDragStart: null,
        nodes: prev.nodes,
        edges: prev.edges,
        pricingOverrides: prev.pricingOverrides,
        sheetConflicts: [],
      });
      set(rebuildDerived(get()));
    },

    getSplitValidations: () => computeSplitSums(get().nodes, get().edges),

    getGrandTotals: () => {
      const s = get();
      let monthly = 0;
      let annual = 0;
      for (const r of s.sheetLineItems) {
        if (r.monthly != null && !Number.isNaN(r.monthly)) monthly += r.monthly;
        if (r.annual != null && !Number.isNaN(r.annual)) annual += r.annual;
      }
      return { monthly, annual };
    },
  };
});
