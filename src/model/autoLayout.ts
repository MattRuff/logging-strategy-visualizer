import type { LayoutOrientation } from "./initialGraph";
import type { StrategyEdge, StrategyNode } from "./types";

/**
 * Layered (Sugiyama-style) auto layout for the strategy graph. Sources are at
 * rank 0; each downstream node is one rank past its deepest parent. Within each
 * rank we run a couple of barycenter passes to reduce edge crossings.
 *
 * The output uses the same column/row gap as initialGraph so manual placement
 * and auto layout produce visually consistent spacing.
 */

const BASE = 80;
const COL_GAP = 240; // along the flow direction
const ROW_GAP = 160; // across the flow

function computeRanks(
  nodes: StrategyNode[],
  edges: StrategyEdge[]
): Map<string, number> {
  const inEdges = new Map<string, string[]>();
  const outEdges = new Map<string, string[]>();
  for (const n of nodes) {
    inEdges.set(n.id, []);
    outEdges.set(n.id, []);
  }
  for (const e of edges) {
    if (!inEdges.has(e.target) || !outEdges.has(e.source)) continue;
    inEdges.get(e.target)!.push(e.source);
    outEdges.get(e.source)!.push(e.target);
  }

  const rank = new Map<string, number>();
  // BFS-style longest-path: process nodes when all parents are ranked.
  // Cycles (which the strategy graph shouldn't have) are broken by capping
  // iterations at nodes.length.
  let changed = true;
  let iters = 0;
  for (const n of nodes) {
    rank.set(n.id, inEdges.get(n.id)!.length === 0 ? 0 : -1);
  }
  while (changed && iters < nodes.length + 2) {
    changed = false;
    iters += 1;
    for (const n of nodes) {
      if (rank.get(n.id)! >= 0) continue;
      const parents = inEdges.get(n.id)!;
      if (parents.length === 0) {
        rank.set(n.id, 0);
        changed = true;
        continue;
      }
      const allKnown = parents.every((p) => (rank.get(p) ?? -1) >= 0);
      if (!allKnown) continue;
      const maxParentRank = Math.max(...parents.map((p) => rank.get(p) ?? 0));
      rank.set(n.id, maxParentRank + 1);
      changed = true;
    }
  }
  // Anything still -1 (truly orphaned by a cycle) gets rank 0 so we don't crash.
  for (const [id, r] of rank) if (r < 0) rank.set(id, 0);
  return rank;
}

function groupByRank(
  nodes: StrategyNode[],
  rank: Map<string, number>
): StrategyNode[][] {
  const layers: StrategyNode[][] = [];
  for (const n of nodes) {
    const r = rank.get(n.id) ?? 0;
    while (layers.length <= r) layers.push([]);
    layers[r].push(n);
  }
  return layers;
}

/**
 * Reorder each layer so nodes sit close to the average position of their
 * parents (or children) in the adjacent layer. Two sweeps (down then up)
 * is enough for graphs at this scale to settle.
 */
function barycenterOrder(
  layers: StrategyNode[][],
  edges: StrategyEdge[]
): void {
  const layerIndex = new Map<string, { layer: number; idx: number }>();
  const recomputeIndex = () => {
    layerIndex.clear();
    layers.forEach((layer, li) =>
      layer.forEach((n, idx) => layerIndex.set(n.id, { layer: li, idx }))
    );
  };
  recomputeIndex();

  const incomingOf = new Map<string, string[]>();
  const outgoingOf = new Map<string, string[]>();
  for (const e of edges) {
    (incomingOf.get(e.target) ?? incomingOf.set(e.target, []).get(e.target)!).push(e.source);
    (outgoingOf.get(e.source) ?? outgoingOf.set(e.source, []).get(e.source)!).push(e.target);
  }

  const orderByMean = (
    layer: StrategyNode[],
    neighborMap: Map<string, string[]>
  ) => {
    const withMean = layer.map((n, originalIdx) => {
      const neighbors = neighborMap.get(n.id) ?? [];
      const indices = neighbors
        .map((id) => layerIndex.get(id)?.idx)
        .filter((v): v is number => v != null);
      const mean =
        indices.length > 0
          ? indices.reduce((a, b) => a + b, 0) / indices.length
          : originalIdx;
      return { n, mean, originalIdx };
    });
    withMean.sort((a, b) =>
      a.mean === b.mean ? a.originalIdx - b.originalIdx : a.mean - b.mean
    );
    return withMean.map((x) => x.n);
  };

  for (let pass = 0; pass < 3; pass++) {
    // Down pass: order each layer by its parents' positions.
    for (let i = 1; i < layers.length; i++) {
      layers[i] = orderByMean(layers[i], incomingOf);
      recomputeIndex();
    }
    // Up pass: order each layer by its children's positions.
    for (let i = layers.length - 2; i >= 0; i--) {
      layers[i] = orderByMean(layers[i], outgoingOf);
      recomputeIndex();
    }
  }
}

/** Auto-layout entry point. Returns nodes with new positions; edges unchanged. */
export function autoLayout(
  nodes: StrategyNode[],
  edges: StrategyEdge[],
  orientation: LayoutOrientation
): StrategyNode[] {
  if (nodes.length === 0) return nodes;
  const rank = computeRanks(nodes, edges);
  const layers = groupByRank(nodes, rank);
  barycenterOrder(layers, edges);

  // Center each layer around y=0 in cross-flow direction so the result fits
  // tidily even when one layer has many more nodes than its neighbors.
  const maxLayerSize = Math.max(...layers.map((l) => l.length));
  const newPos = new Map<string, { x: number; y: number }>();
  layers.forEach((layer, layerIdx) => {
    const offset = (maxLayerSize - layer.length) / 2;
    layer.forEach((n, slot) => {
      const flowCoord = BASE + layerIdx * COL_GAP;
      const crossCoord = BASE + (slot + offset) * ROW_GAP;
      if (orientation === "horizontal") {
        newPos.set(n.id, { x: flowCoord, y: crossCoord });
      } else {
        newPos.set(n.id, { x: crossCoord, y: flowCoord });
      }
    });
  });

  return nodes.map((n) => {
    const p = newPos.get(n.id);
    return p ? { ...n, position: p } : n;
  });
}
