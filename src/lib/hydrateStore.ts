// Hydrate the stable strategyStore from a server-fetched workload payload.
// We replicate just the modern (v3) post-validation steps from
// importStrategyXlsxFromBuffer (../../../src/lib/xlsxSync.ts:321) so we can avoid
// modifying stable code. Legacy migrations are skipped — workloads created
// through this app are always v3.

import { useStrategyStore, reseedIdCounter, genId } from "@/state/strategyStore";
import { enforceFlexComputeInvariant } from "@/model/flexInvariant";
import { computeNodeVolumes } from "@/model/graphMath";
import { pickFlexComputeTier } from "@/model/pricingCatalog";
import { nearestFlexRetentionDays } from "@/model/flexRetention";
import { buildSheetLineItems } from "@/model/sheetLineItems";
import type { StrategyEdge, StrategyNode } from "@/model/types";
import type { LayoutOrientation } from "@/model/initialGraph";
import type { PricingKey } from "@/model/pricingCatalog";

interface ServerPayload {
  v: 3;
  nodes: StrategyNode[];
  edges: StrategyEdge[];
  pricingOverrides: Partial<Record<PricingKey, number>>;
  flexComputeTier: ReturnType<typeof pickFlexComputeTier>;
  layoutOrientation: LayoutOrientation;
}

export function hydrateStoreFromPayload(payload: ServerPayload): void {
  let nodes = payload.nodes;
  let edges = payload.edges;
  reseedIdCounter(nodes, edges);

  const enforced = enforceFlexComputeInvariant(nodes, edges, genId);
  nodes = enforced.nodes;
  edges = enforced.edges;

  const nodeVolumes = computeNodeVolumes(nodes, edges);
  let flexEvents = 0;
  for (const n of nodes) {
    if (n.data?.kind !== "flex") continue;
    const mLines = nodeVolumes.get(n.id)?.millionLinesPerMonth ?? 0;
    const days = nearestFlexRetentionDays(n.data.flexRetentionDays ?? 30);
    flexEvents += mLines * 1e6 * (days / 30);
  }
  const flexComputeTier = pickFlexComputeTier(flexEvents);
  const sheetLineItems = buildSheetLineItems({
    nodes,
    edges,
    pricingOverrides: payload.pricingOverrides,
    flexComputeTier,
    nodeVolumes,
  });

  useStrategyStore.setState({
    nodes,
    edges,
    pricingOverrides: payload.pricingOverrides,
    flexComputeTier,
    layoutOrientation: payload.layoutOrientation,
    nodeVolumes,
    sheetLineItems,
    sheetConflicts: [],
    selectedNodeId: null,
  });
}
