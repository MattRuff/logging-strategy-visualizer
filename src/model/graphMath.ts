import {
  DEFAULT_MILLION_LINES_PER_MONTH,
  DEFAULT_TOTAL_TB_PER_MONTH,
} from "./volumeDefaults";
import type { StrategyEdge, StrategyNode } from "./types";

const DEST_KINDS = new Set(["flex", "index", "archive"]);

export interface LeafVolume {
  nodeId: string;
  kind: "flex" | "index" | "archive";
  fractionOfTotal: number;
  tbPerDay: number;
}

function childrenOf(
  parentId: string,
  edges: StrategyEdge[]
): { nodeId: string; pct: number; edgeId: string }[] {
  return edges
    .filter((e) => e.source === parentId)
    .map((e) => ({
      nodeId: e.target,
      pct: Math.max(0, Math.min(100, e.data?.pct ?? 0)),
      edgeId: e.id,
    }));
}

export function tbPerDayToTbPerMonth(tbPerDay: number): number {
  return tbPerDay * 30;
}

export function tbPerMonthToTbPerDay(tbPerMonth: number): number {
  return tbPerMonth / 30;
}

/** TB/month and million-lines inputs must never be NaN/undefined (breaks ingest/index math). */
export function finiteNonNegative(n: unknown, fallback: number): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x) || x < 0) return fallback;
  return x;
}

/** DFS tree: first path wins if multiple edges to the same target exist. */
export function pathFractionToNode(
  rootId: string,
  targetId: string,
  nodes: StrategyNode[],
  edges: StrategyEdge[]
): { fraction: number; path: string[] } | null {
  function walk(
    currentId: string,
    acc: number,
    path: string[]
  ): { fraction: number; path: string[] } | null {
    if (currentId === targetId) return { fraction: acc, path };

    const children = childrenOf(currentId, edges);
    for (const ch of children) {
      const nextFrac = acc * (ch.pct / 100);
      const res = walk(ch.nodeId, nextFrac, [...path, ch.edgeId]);
      if (res) return res;
    }
    return null;
  }

  if (!nodes.some((n) => n.id === rootId)) return null;
  return walk(rootId, 1, []);
}

export function computeSplitSums(
  nodes: StrategyNode[],
  edges: StrategyEdge[]
): { nodeId: string; label: string; sumPct: number; ok: boolean }[] {
  const byParent = new Map<string, number>();
  for (const e of edges) {
    const p = e.data?.pct ?? 0;
    byParent.set(e.source, (byParent.get(e.source) ?? 0) + p);
  }
  const out: { nodeId: string; label: string; sumPct: number; ok: boolean }[] =
    [];
  for (const n of nodes) {
    const hasOut = edges.some((e) => e.source === n.id);
    if (!hasOut) continue;
    const sum = byParent.get(n.id) ?? 0;
    const label = n.data?.label ?? n.id;
    out.push({
      nodeId: n.id,
      label,
      sumPct: Math.round(sum * 1000) / 1000,
      ok: Math.abs(sum - 100) < 0.001,
    });
  }
  return out;
}

export function computeLeafVolumes(
  rootId: string,
  totalTbPerDay: number,
  nodes: StrategyNode[],
  edges: StrategyEdge[]
): LeafVolume[] {
  const leaves: LeafVolume[] = [];
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  function walk(nodeId: string, fraction: number) {
    const node = nodeById.get(nodeId);
    if (!node) return;
    const kind = node.data?.kind;
    const ch = childrenOf(nodeId, edges);
    if (ch.length === 0) {
      if (kind && DEST_KINDS.has(kind)) {
        leaves.push({
          nodeId,
          kind: kind as "flex" | "index" | "archive",
          fractionOfTotal: fraction,
          tbPerDay: totalTbPerDay * fraction,
        });
      }
      return;
    }
    for (const c of ch) {
      walk(c.nodeId, fraction * (c.pct / 100));
    }
  }

  walk(rootId, 1);
  return leaves;
}

/** Sorted source node ids (stable ordering). */
export function sourceNodeIdsSorted(nodes: StrategyNode[]): string[] {
  return nodes
    .filter((n) => n.data?.kind === "source")
    .map((n) => n.id)
    .sort((a, b) => a.localeCompare(b));
}

/** First source id; used when a single root path is required (e.g. sheet % edit). */
export function primarySourceId(nodes: StrategyNode[]): string | null {
  const ids = sourceNodeIdsSorted(nodes);
  return ids[0] ?? null;
}

export function sumSourceTbPerMonth(nodes: StrategyNode[]): number {
  return nodes
    .filter((n) => n.data?.kind === "source")
    .reduce(
      (acc, n) =>
        acc +
        finiteNonNegative(n.data.totalTbPerMonth, DEFAULT_TOTAL_TB_PER_MONTH),
      0
    );
}

export function sumSourceMillionLinesPerMonth(nodes: StrategyNode[]): number {
  return nodes
    .filter((n) => n.data?.kind === "source")
    .reduce(
      (acc, n) =>
        acc +
        finiteNonNegative(
          n.data.millionLinesPerMonth,
          DEFAULT_MILLION_LINES_PER_MONTH
        ),
      0
    );
}

/** TB/month reaching `nodeId`, summed over all source roots. */
export function effectiveTbPerMonthAtNode(
  nodes: StrategyNode[],
  edges: StrategyEdge[],
  nodeId: string
): number {
  let sum = 0;
  for (const n of nodes) {
    if (n.data?.kind !== "source") continue;
    const path = pathFractionToNode(n.id, nodeId, nodes, edges);
    const frac = path?.fraction ?? 0;
    const tb = finiteNonNegative(n.data.totalTbPerMonth, DEFAULT_TOTAL_TB_PER_MONTH);
    sum += tb * frac;
  }
  return sum;
}

/** Million lines/month reaching `nodeId`, summed over all sources. */
export function effectiveMillionLinesAtNode(
  nodes: StrategyNode[],
  edges: StrategyEdge[],
  nodeId: string
): number {
  let sum = 0;
  for (const n of nodes) {
    if (n.data?.kind !== "source") continue;
    const path = pathFractionToNode(n.id, nodeId, nodes, edges);
    const frac = path?.fraction ?? 0;
    const m = finiteNonNegative(
      n.data.millionLinesPerMonth,
      DEFAULT_MILLION_LINES_PER_MONTH
    );
    sum += m * frac;
  }
  return sum;
}

/** TB/day reaching `nodeId` from all sources. */
export function effectiveTbPerDayAtNode(
  nodes: StrategyNode[],
  edges: StrategyEdge[],
  nodeId: string
): number {
  return tbPerMonthToTbPerDay(effectiveTbPerMonthAtNode(nodes, edges, nodeId));
}

/** Flex/index/archive leaves with TB/day summed across all sources. */
export function computeLeafVolumesFromSources(
  nodes: StrategyNode[],
  edges: StrategyEdge[]
): LeafVolume[] {
  const sources = nodes.filter((n) => n.data?.kind === "source");
  const leafMap = new Map<
    string,
    { kind: "flex" | "index" | "archive"; tbPerDay: number }
  >();

  for (const src of sources) {
    const tbMo = finiteNonNegative(
      src.data.totalTbPerMonth,
      DEFAULT_TOTAL_TB_PER_MONTH
    );
    const tbDay = tbPerMonthToTbPerDay(tbMo);
    const leaves = computeLeafVolumes(src.id, tbDay, nodes, edges);
    for (const lv of leaves) {
      const prev = leafMap.get(lv.nodeId);
      if (!prev) {
        leafMap.set(lv.nodeId, { kind: lv.kind, tbPerDay: lv.tbPerDay });
      } else {
        prev.tbPerDay += lv.tbPerDay;
      }
    }
  }

  const totalSourceTbDay = sources.reduce(
    (s, n) =>
      s +
      tbPerMonthToTbPerDay(
        finiteNonNegative(n.data.totalTbPerMonth, DEFAULT_TOTAL_TB_PER_MONTH)
      ),
    0
  );

  return [...leafMap.entries()].map(([nodeId, v]) => ({
    nodeId,
    kind: v.kind,
    fractionOfTotal:
      totalSourceTbDay > 0 ? v.tbPerDay / totalSourceTbDay : 0,
    tbPerDay: v.tbPerDay,
  }));
}

/** BFS from all sources (queue seeded with sorted source ids). */
export function orderedBfsFromSources(
  nodes: StrategyNode[],
  edges: StrategyEdge[]
): string[] {
  const sourceIds = sourceNodeIdsSorted(nodes);
  if (sourceIds.length === 0) {
    return [...nodes]
      .map((n) => n.id)
      .sort((a, b) => a.localeCompare(b));
  }
  const bySource = new Map<string, StrategyEdge[]>();
  for (const e of edges) {
    const list = bySource.get(e.source) ?? [];
    list.push(e);
    bySource.set(e.source, list);
  }
  for (const [, list] of bySource) {
    list.sort((a, b) => a.target.localeCompare(b.target));
  }

  const out: string[] = [];
  const seen = new Set<string>();
  const q = [...sourceIds];

  while (q.length) {
    const id = q.shift()!;
    if (seen.has(id)) continue;
    if (!nodes.some((n) => n.id === id)) continue;
    seen.add(id);
    out.push(id);
    for (const e of bySource.get(id) ?? []) {
      q.push(e.target);
    }
  }

  for (const n of nodes) {
    if (!seen.has(n.id)) out.push(n.id);
  }
  return out;
}

/** BFS from root; children sorted by target id for stable order. */
export function orderedBfsNodeIds(
  rootId: string,
  nodes: StrategyNode[],
  edges: StrategyEdge[]
): string[] {
  const bySource = new Map<string, StrategyEdge[]>();
  for (const e of edges) {
    const list = bySource.get(e.source) ?? [];
    list.push(e);
    bySource.set(e.source, list);
  }
  for (const [, list] of bySource) {
    list.sort((a, b) => a.target.localeCompare(b.target));
  }

  const out: string[] = [];
  const seen = new Set<string>();
  const q: string[] = [rootId];

  while (q.length) {
    const id = q.shift()!;
    if (seen.has(id)) continue;
    if (!nodes.some((n) => n.id === id)) continue;
    seen.add(id);
    out.push(id);
    for (const e of bySource.get(id) ?? []) {
      q.push(e.target);
    }
  }

  for (const n of nodes) {
    if (!seen.has(n.id)) out.push(n.id);
  }
  return out;
}
