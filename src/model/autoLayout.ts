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
// Generous gaps so the edge label (PctEdge inputs ≈ 240×60 with the × delete
// button) sits cleanly between nodes along the flow direction, and parallel
// sibling edges don't collide.
const COL_GAP = 360; // along the flow direction
const ROW_GAP = 240; // across the flow

// Group container fitting parameters.
const GROUP_PADDING = 36; // buffer around enclosed nodes (left/right/bottom)
const GROUP_HEADER = 36; // additional top padding for the header bar
const NODE_W_ESTIMATE = 220;
const NODE_H_ESTIMATE = 96;

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

/**
 * Within each layer, keep nodes that share a parent group contiguous so a
 * group's bbox stays a tight cluster instead of striping across the lane and
 * swallowing siblings of another group. Group order within a layer is
 * preserved by mean barycenter index of its members.
 */
function clusterByParent(layers: StrategyNode[][]): void {
  for (let li = 0; li < layers.length; li++) {
    const layer = layers[li];
    const buckets = new Map<string, { mean: number; nodes: StrategyNode[] }>();
    layer.forEach((n, idx) => {
      const key = n.parentId ?? "";
      let b = buckets.get(key);
      if (!b) {
        b = { mean: 0, nodes: [] };
        buckets.set(key, b);
      }
      b.nodes.push(n);
      b.mean += idx;
    });
    for (const b of buckets.values()) b.mean /= b.nodes.length;
    layers[li] = [...buckets.values()]
      .sort((a, b) => a.mean - b.mean)
      .flatMap((b) => b.nodes);
  }
}

/**
 * Auto-layout entry point. Returns nodes with new positions; edges unchanged.
 *
 * Group-aware: groups are excluded from the layered flow layout (they have no
 * ports). Their children are laid out as if absolute, then each group is
 * repositioned + resized to wrap its children with padding, and children's
 * positions are converted back to be relative to the group.
 */
export function autoLayout(
  nodes: StrategyNode[],
  edges: StrategyEdge[],
  orientation: LayoutOrientation
): StrategyNode[] {
  if (nodes.length === 0) return nodes;

  // Layout the connected flow ignoring group containers.
  const flowNodes = nodes.filter((n) => n.type !== "group");
  const rank = computeRanks(flowNodes, edges);
  const layers = groupByRank(flowNodes, rank);
  barycenterOrder(layers, edges);
  clusterByParent(layers);

  const maxLayerSize = Math.max(...layers.map((l) => l.length), 1);
  const newAbs = new Map<string, { x: number; y: number }>();
  layers.forEach((layer, layerIdx) => {
    const offset = (maxLayerSize - layer.length) / 2;
    layer.forEach((n, slot) => {
      const flowCoord = BASE + layerIdx * COL_GAP;
      const crossCoord = BASE + (slot + offset) * ROW_GAP;
      if (orientation === "horizontal") {
        newAbs.set(n.id, { x: flowCoord, y: crossCoord });
      } else {
        newAbs.set(n.id, { x: crossCoord, y: flowCoord });
      }
    });
  });

  // Push apart groups whose flow-axis bboxes overlap on the cross axis. We
  // iterate by current cross-axis position so later groups slide further out.
  // Children move with their group, which keeps inter-group edges valid (group
  // size is recomputed below from the post-shift child positions).
  const isHorizontal = orientation === "horizontal";
  type Rect = {
    groupId: string;
    childIds: string[];
    flowMin: number;
    flowMax: number;
    crossMin: number;
    crossMax: number;
  };
  const computeRect = (g: StrategyNode): Rect | null => {
    const children = nodes.filter((n) => n.parentId === g.id);
    if (children.length === 0) return null;
    const positions = children
      .map((c) => ({ id: c.id, p: newAbs.get(c.id) }))
      .filter((x): x is { id: string; p: { x: number; y: number } } => !!x.p);
    if (positions.length === 0) return null;
    const ws = children.map(
      (c) => c.measured?.width ?? c.width ?? NODE_W_ESTIMATE
    );
    const hs = children.map(
      (c) => c.measured?.height ?? c.height ?? NODE_H_ESTIMATE
    );
    const xs = positions.map((x) => x.p.x);
    const ys = positions.map((x) => x.p.y);
    const xe = positions.map((x, i) => x.p.x + ws[i]);
    const ye = positions.map((x, i) => x.p.y + hs[i]);
    const flowMin = isHorizontal
      ? Math.min(...xs) - GROUP_PADDING
      : Math.min(...ys) - GROUP_PADDING - GROUP_HEADER;
    const flowMax = isHorizontal
      ? Math.max(...xe) + GROUP_PADDING
      : Math.max(...ye) + GROUP_PADDING;
    const crossMin = isHorizontal
      ? Math.min(...ys) - GROUP_PADDING - GROUP_HEADER
      : Math.min(...xs) - GROUP_PADDING;
    const crossMax = isHorizontal
      ? Math.max(...ye) + GROUP_PADDING
      : Math.max(...xe) + GROUP_PADDING;
    return {
      groupId: g.id,
      childIds: positions.map((x) => x.id),
      flowMin,
      flowMax,
      crossMin,
      crossMax,
    };
  };

  const rects = nodes
    .filter((n) => n.type === "group")
    .map(computeRect)
    .filter((r): r is Rect => !!r);
  rects.sort((a, b) => a.crossMin - b.crossMin);
  for (let i = 1; i < rects.length; i++) {
    for (let j = 0; j < i; j++) {
      const A = rects[j];
      const B = rects[i];
      const flowOverlap = !(A.flowMax <= B.flowMin || B.flowMax <= A.flowMin);
      const crossOverlap = !(A.crossMax <= B.crossMin || B.crossMax <= A.crossMin);
      if (flowOverlap && crossOverlap) {
        const shift = A.crossMax - B.crossMin + GROUP_PADDING;
        for (const id of B.childIds) {
          const p = newAbs.get(id);
          if (!p) continue;
          if (isHorizontal) p.y += shift;
          else p.x += shift;
        }
        B.crossMin += shift;
        B.crossMax += shift;
      }
    }
  }

  // For each group: compute children bbox (absolute) → resize + reposition the
  // group with padding, then convert children to relative coords.
  const groupResults = new Map<
    string,
    { pos: { x: number; y: number }; size: { width: number; height: number } }
  >();
  for (const g of nodes) {
    if (g.type !== "group") continue;
    const children = nodes.filter((n) => n.parentId === g.id);
    if (children.length === 0) continue;
    const positions = children
      .map((c) => newAbs.get(c.id))
      .filter((p): p is { x: number; y: number } => !!p);
    if (positions.length === 0) continue;
    const ws = children.map(
      (c) => c.measured?.width ?? c.width ?? NODE_W_ESTIMATE
    );
    const hs = children.map(
      (c) => c.measured?.height ?? c.height ?? NODE_H_ESTIMATE
    );
    const minX = Math.min(...positions.map((p) => p.x));
    const minY = Math.min(...positions.map((p) => p.y));
    const maxX = Math.max(...positions.map((p, i) => p.x + ws[i]));
    const maxY = Math.max(...positions.map((p, i) => p.y + hs[i]));
    groupResults.set(g.id, {
      pos: {
        x: minX - GROUP_PADDING,
        y: minY - GROUP_PADDING - GROUP_HEADER,
      },
      size: {
        width: maxX - minX + GROUP_PADDING * 2,
        height: maxY - minY + GROUP_PADDING * 2 + GROUP_HEADER,
      },
    });
  }

  return nodes.map((n) => {
    if (n.type === "group") {
      const r = groupResults.get(n.id);
      if (!r) return n;
      return {
        ...n,
        position: r.pos,
        style: { ...(n.style ?? {}), width: r.size.width, height: r.size.height },
      };
    }
    const abs = newAbs.get(n.id);
    if (!abs) return n;
    if (n.parentId) {
      const g = groupResults.get(n.parentId);
      if (g) {
        return {
          ...n,
          position: { x: abs.x - g.pos.x, y: abs.y - g.pos.y },
        };
      }
    }
    return { ...n, position: abs };
  });
}
