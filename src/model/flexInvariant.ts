import type { StrategyEdge, StrategyNode } from "./types";

/**
 * Invariant: if any kind === "flex" node exists, exactly one kind === "flex_compute"
 * parent must exist with a flex_compute → flex edge for each flex child. Pre-feature
 * graphs (and graphs after a deletion) get reconciled here.
 *
 * The genId callback supplies fresh node/edge ids in the host's namespace.
 */
export function enforceFlexComputeInvariant(
  nodes: StrategyNode[],
  edges: StrategyEdge[],
  genId: (prefix: "n" | "e") => string
): { nodes: StrategyNode[]; edges: StrategyEdge[] } {
  const flexNodes = nodes.filter((n) => n.data?.kind === "flex");
  const computeNodes = nodes.filter((n) => n.data?.kind === "flex_compute");

  if (flexNodes.length === 0) {
    if (computeNodes.length === 0) return { nodes, edges };
    const computeIds = new Set(computeNodes.map((n) => n.id));
    return {
      nodes: nodes.filter((n) => !computeIds.has(n.id)),
      edges: edges.filter(
        (e) => !computeIds.has(e.source) && !computeIds.has(e.target)
      ),
    };
  }

  let workingNodes = nodes;
  let workingEdges = edges;
  let computeId: string;

  if (computeNodes.length === 0) {
    computeId = genId("n");
    const anchor = flexNodes[0].position;
    const synthesized: StrategyNode = {
      id: computeId,
      type: "strategy",
      position: { x: anchor.x, y: Math.max(0, anchor.y - 160) },
      data: { kind: "flex_compute", label: "Flex Compute" },
    };
    workingNodes = [...nodes, synthesized];

    // Migration: rewire any X → flex edges through the new compute parent.
    const flexIds = new Set(flexNodes.map((n) => n.id));
    const sourcePctTotals = new Map<string, number>();
    const downstreamPct = new Map<string, number>();
    const remainingEdges: StrategyEdge[] = [];
    for (const e of edges) {
      if (flexIds.has(e.target) && !flexIds.has(e.source)) {
        const pct = e.data?.pct ?? 0;
        sourcePctTotals.set(
          e.source,
          (sourcePctTotals.get(e.source) ?? 0) + pct
        );
        downstreamPct.set(
          e.target,
          (downstreamPct.get(e.target) ?? 0) + pct
        );
      } else {
        remainingEdges.push(e);
      }
    }
    for (const [source, pctSum] of sourcePctTotals) {
      remainingEdges.push({
        id: genId("e"),
        source,
        target: computeId,
        type: "pct",
        data: { pct: Math.min(100, pctSum) },
      });
    }
    const totalDownstream = [...downstreamPct.values()].reduce(
      (s, x) => s + x,
      0
    );
    for (const f of flexNodes) {
      const pct = downstreamPct.get(f.id) ?? 0;
      const share =
        totalDownstream > 0
          ? Math.round((pct / totalDownstream) * 100 * 1000) / 1000
          : Math.round((100 / flexNodes.length) * 1000) / 1000;
      remainingEdges.push({
        id: genId("e"),
        source: computeId,
        target: f.id,
        type: "pct",
        data: { pct: share },
      });
    }
    workingEdges = remainingEdges;
    return { nodes: workingNodes, edges: workingEdges };
  }

  computeId = computeNodes[0].id;
  if (computeNodes.length > 1) {
    const extras = new Set(computeNodes.slice(1).map((n) => n.id));
    workingNodes = nodes.filter((n) => !extras.has(n.id));
    workingEdges = edges.filter(
      (e) => !extras.has(e.source) && !extras.has(e.target)
    );
  }

  const flexIds = new Set(flexNodes.map((n) => n.id));
  const childrenWithEdge = new Set(
    workingEdges
      .filter((e) => e.source === computeId && flexIds.has(e.target))
      .map((e) => e.target)
  );
  const missingChildren = flexNodes.filter((n) => !childrenWithEdge.has(n.id));
  if (missingChildren.length > 0) {
    const evenPct = Math.round((100 / flexNodes.length) * 1000) / 1000;
    workingEdges = [
      ...workingEdges,
      ...missingChildren.map((c) => ({
        id: genId("e"),
        source: computeId,
        target: c.id,
        type: "pct" as const,
        data: { pct: evenPct },
      })),
    ];
  }

  return { nodes: workingNodes, edges: workingEdges };
}
