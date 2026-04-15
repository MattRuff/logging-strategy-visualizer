import {
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import { create } from "zustand";
import { createInitialGraph } from "@/model/initialGraph";
import {
  computeSplitSums,
  pathFractionToNode,
  primarySourceId,
} from "@/model/graphMath";
import type { FlexComputeTier, PricingKey } from "@/model/pricingCatalog";
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

function rebuildSheetLineItems(
  s: Pick<
    StrategyStore,
    "nodes" | "edges" | "pricingOverrides" | "flexComputeTier"
  >
): LineItem[] {
  return buildSheetLineItems({
    nodes: s.nodes,
    edges: s.edges,
    pricingOverrides: s.pricingOverrides,
    flexComputeTier: s.flexComputeTier,
  });
}

export interface StrategyStore {
  nodes: StrategyNode[];
  edges: StrategyEdge[];
  sheetLineItems: LineItem[];
  pricingOverrides: Partial<Record<PricingKey, number>>;
  flexComputeTier: FlexComputeTier;
  sheetConflicts: string[];
  selectedNodeId: string | null;

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

  setPricingOverride: (key: PricingKey, value: number | undefined) => void;
  resetPricingDefaults: () => void;
  setFlexComputeTier: (t: FlexComputeTier) => void;

  applyRoutePctFromSheet: (routeNodeId: string, pctOfTotalLeaf: number) => void;

  newScenario: () => void;

  setSelectedNodeId: (id: string | null) => void;

  getSplitValidations: () => ReturnType<typeof computeSplitSums>;
  getGrandTotals: () => { monthly: number; annual: number };
}

let idCounter = 0;
function genId(prefix: string) {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
}

export const useStrategyStore = create<StrategyStore>((set, get) => {
  const initial = createInitialGraph();

  const baseState = {
    nodes: initial.nodes,
    edges: initial.edges,
    pricingOverrides: {} as Partial<Record<PricingKey, number>>,
    flexComputeTier: "sm" as FlexComputeTier,
    sheetConflicts: [] as string[],
    selectedNodeId: null as string | null,
  };

  const sheetLineItems = rebuildSheetLineItems({
    ...baseState,
    nodes: initial.nodes,
    edges: initial.edges,
  });

  return {
    ...baseState,
    sheetLineItems,

    onNodesChange: (changes) => {
      set((state) => ({
        nodes: applyNodeChanges(changes, state.nodes),
      }));
      set({ sheetLineItems: rebuildSheetLineItems(get()) });
    },

    onEdgesChange: (changes) => {
      set((state) => ({
        edges: applyEdgeChanges(changes, state.edges),
      }));
      set({ sheetLineItems: rebuildSheetLineItems(get()) });
    },

    updateEdgePct: (edgeId, pct) => {
      const clamped = Math.max(0, Math.min(100, pct));
      set((state) => ({
        edges: state.edges.map((e) =>
          e.id === edgeId
            ? { ...e, data: { ...e.data, pct: clamped } }
            : e
        ),
      }));
      set({ sheetLineItems: rebuildSheetLineItems(get()) });
    },

    addStrategyNode: (kind, label, position) => {
      const id = genId("n");
      const defaultLabel =
        label ??
        ({
          source: "Source",
          pipelines: "Observability Pipelines",
          ingest: "Ingest",
          flex: "Flex logs",
          index: "Indexed logs",
          archive: "Archive",
        }[kind] as string);

      const data: StrategyNodeData = {
        kind,
        label: defaultLabel,
        totalTbPerMonth:
          kind === "source" ? DEFAULT_TOTAL_TB_PER_MONTH : undefined,
        millionLinesPerMonth:
          kind === "source" ? DEFAULT_MILLION_LINES_PER_MONTH : undefined,
        retentionDays: kind === "index" ? 3 : undefined,
        flexRetentionDays: kind === "flex" ? 30 : undefined,
        tierLabel: kind === "index" ? "Standard" : undefined,
      };

      const pos = position ?? {
        x: 100 + Math.random() * 400,
        y: 200 + Math.random() * 200,
      };

      set((state) => ({
        nodes: [
          ...state.nodes,
          {
            id,
            type: "strategy",
            position: pos,
            data,
          },
        ],
      }));
      set({ sheetLineItems: rebuildSheetLineItems(get()) });
    },

    connectNodes: (source, target, pct = 50) => {
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
      set({ sheetLineItems: rebuildSheetLineItems(get()) });
    },

    connectFromFlow: (c) => {
      if (!c.source || !c.target) return;
      set((state) => {
        const dup = state.edges.some(
          (e) => e.source === c.source && e.target === c.target
        );
        if (dup) return state;
        const id = genId("e");
        return {
          edges: [
            ...state.edges,
            {
              id,
              source: c.source,
              target: c.target,
              type: "pct",
              data: { pct: 50 },
            },
          ],
        };
      });
      set({ sheetLineItems: rebuildSheetLineItems(get()) });
    },

    updateNodeData: (id, partial) => {
      set((state) => ({
        nodes: state.nodes.map((n) =>
          n.id === id
            ? { ...n, data: { ...n.data, ...partial } as StrategyNodeData }
            : n
        ),
      }));
      set({ sheetLineItems: rebuildSheetLineItems(get()) });
    },

    setPricingOverride: (key, value) => {
      set((state) => {
        const next = { ...state.pricingOverrides };
        if (value === undefined || Number.isNaN(value)) {
          delete next[key];
        } else {
          next[key] = value;
        }
        return { pricingOverrides: next };
      });
      set({ sheetLineItems: rebuildSheetLineItems(get()) });
    },

    resetPricingDefaults: () => {
      set({ pricingOverrides: {} });
      set({ sheetLineItems: rebuildSheetLineItems(get()) });
    },

    setFlexComputeTier: (t) => {
      set({ flexComputeTier: t });
      set({ sheetLineItems: rebuildSheetLineItems(get()) });
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
      set({ sheetLineItems: rebuildSheetLineItems(get()) });
    },

    newScenario: () => {
      const g = createInitialGraph();
      set({
        nodes: g.nodes,
        edges: g.edges,
        pricingOverrides: {},
        flexComputeTier: "sm",
        sheetConflicts: [],
        selectedNodeId: null,
      });
      set({ sheetLineItems: rebuildSheetLineItems(get()) });
    },

    setSelectedNodeId: (id) => set({ selectedNodeId: id }),

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
