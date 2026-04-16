import {
  computeLeafVolumesFromSources,
  effectiveMillionLinesAtNode,
  effectiveTbPerDayAtNode,
  effectiveTbPerMonthAtNode,
  orderedBfsFromSources,
  sumSourceTbPerMonth,
  tbPerDayToTbPerMonth,
} from "./graphMath";
import {
  type FlexComputeTier,
  flexTierToPricingKey,
  indexedRetentionToKey,
  resolvePrice,
  type PricingKey,
} from "./pricingCatalog";
import { nearestFlexRetentionDays } from "./flexRetention";
import type {
  LineItem,
  StrategyEdge,
  StrategyNode,
} from "./types";

export interface SheetLineItemsInput {
  nodes: StrategyNode[];
  edges: StrategyEdge[];
  pricingOverrides: Partial<Record<PricingKey, number>>;
  flexComputeTier: FlexComputeTier;
}

function annual(m: number | null): number | null {
  if (m == null || Number.isNaN(m)) return null;
  return Math.round(m * 12 * 100) / 100;
}

export function buildSheetLineItems(p: SheetLineItemsInput): LineItem[] {
  const { nodes, edges } = p;
  const ov = p.pricingOverrides;
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const order = orderedBfsFromSources(nodes, edges);
  const sumTbMo = Math.max(
    sumSourceTbPerMonth(nodes),
    Number.EPSILON
  );

  const hasFlexNode = nodes.some((n) => n.data?.kind === "flex");
  const flexLeaves = computeLeafVolumesFromSources(nodes, edges).filter(
    (lv) => lv.kind === "flex"
  );

  function buildFlexStorageLineItem(): LineItem {
    const bucketRate = resolvePrice("flex_bucket_per_30d", ov);
    let flexMonthly = 0;
    for (const lv of flexLeaves) {
      const n = nodeById.get(lv.nodeId);
      const days = nearestFlexRetentionDays(n?.data?.flexRetentionDays ?? 30);
      const tbMo = tbPerDayToTbPerMonth(lv.tbPerDay);
      const buckets = days / 30;
      flexMonthly += tbMo * bucketRate * buckets;
    }
    flexMonthly = Math.round(flexMonthly * 100) / 100;
    const totalTbMo = flexLeaves.reduce(
      (s, lv) => s + tbPerDayToTbPerMonth(lv.tbPerDay),
      0
    );
    const effUnit =
      totalTbMo > 0
        ? Math.round((flexMonthly / totalTbMo) * 10000) / 10000
        : bucketRate;

    const pctOfTotal =
      sumTbMo > 0
        ? Math.round((totalTbMo / sumTbMo) * 100000) / 1000
        : 0;
    const routeNodeId =
      flexLeaves.length === 1 ? flexLeaves[0].nodeId : undefined;

    let flexStorageDescription: string;
    if (flexLeaves.length === 0) {
      flexStorageDescription = "Flex Storage";
    } else if (flexLeaves.length === 1) {
      const d = nearestFlexRetentionDays(
        nodeById.get(flexLeaves[0].nodeId)?.data?.flexRetentionDays ?? 30
      );
      flexStorageDescription = `Flex Storage ${d}`;
    } else {
      flexStorageDescription = "Flex Storage (multiple)";
    }

    return {
      id: "flex-storage-aggregate",
      lineKind: "flex_aggregate",
      displayType: "Flex Storage",
      skuKey: "flex_storage_aggregate",
      routeNodeId,
      nodeLabel: routeNodeId
        ? (nodeById.get(routeNodeId)?.data.label ?? "")
        : "",
      pctOfTotal,
      description: flexStorageDescription,
      quantityPerMonth: Math.round(totalTbMo * 1000) / 1000,
      unitPrice: effUnit,
      monthly: flexMonthly,
      annual: annual(flexMonthly),
      millionLinesNote: "TB/mo · blended $/TB-mo",
      pricingKey: "flex_bucket_per_30d",
    };
  }

  const rows: LineItem[] = [];
  let flexStorageRowAdded = false;

  for (const nodeId of order) {
    const node = nodeById.get(nodeId);
    if (!node) continue;
    const kind = node.data.kind;
    const effTbMo = effectiveTbPerMonthAtNode(nodes, edges, nodeId);
    const pct =
      sumTbMo > 0
        ? Math.round((effTbMo / sumTbMo) * 100000) / 1000
        : 0;

    const base: Omit<
      LineItem,
      | "monthly"
      | "annual"
      | "unitPrice"
      | "quantityPerMonth"
      | "description"
      | "millionLinesNote"
      | "pricingKey"
      | "skuKey"
      | "displayType"
    > = {
      id: `node-${nodeId}`,
      lineKind: "node",
      routeNodeId: nodeId,
      pctOfTotal: pct,
    };

    if (kind === "flex") {
      if (!flexStorageRowAdded && flexLeaves.length > 0) {
        flexStorageRowAdded = true;
        rows.push(buildFlexStorageLineItem());
      }
      continue;
    }

    if (kind === "source") {
      continue;
    }

    if (kind === "pipelines") {
      const effTbDay = effectiveTbPerDayAtNode(nodes, edges, nodeId);
      const ops = Math.max(1, Math.ceil(effTbDay));
      const opRate = resolvePrice("op_monthly_per_op", ov);
      const monthly = ops * opRate;
      rows.push({
        ...base,
        nodeLabel: node.data.label,
        displayType: "OP",
        skuKey: "observability_pipelines_plus",
        description: "Observability Pipelines",
        quantityPerMonth: Math.round(effTbMo * 1000) / 1000,
        unitPrice: opRate,
        monthly,
        annual: annual(monthly),
        millionLinesNote: "TB/mo",
        pricingKey: "op_monthly_per_op",
      });
      continue;
    }

    if (kind === "ingest") {
      const q = Math.round(
        effectiveMillionLinesAtNode(nodes, edges, nodeId) * 1000
      ) / 1000;
      const unit = resolvePrice("log_ingest_per_million", ov);
      const monthly = Math.round(q * unit * 100) / 100;
      rows.push({
        ...base,
        nodeLabel: node.data.label,
        displayType: "Ingest",
        skuKey: "log_ingestion",
        description: "Log ingestion",
        quantityPerMonth: q,
        unitPrice: unit,
        monthly,
        annual: annual(monthly),
        millionLinesNote: "Million log lines, per month",
        pricingKey: "log_ingest_per_million",
      });
      continue;
    }

    if (kind === "index") {
      const days = node.data.retentionDays ?? 3;
      const pk = indexedRetentionToKey(days);
      const q = Math.round(
        effectiveMillionLinesAtNode(nodes, edges, nodeId) * 1000
      ) / 1000;
      const unit = resolvePrice(pk, ov);
      const monthly = Math.round(q * unit * 100) / 100;
      rows.push({
        ...base,
        nodeLabel: node.data.label,
        displayType: "Standard",
        skuKey: `standard_${days}d`,
        description: `Standard Index ${days}`,
        quantityPerMonth: q,
        unitPrice: unit,
        monthly,
        annual: annual(monthly),
        millionLinesNote: "Million log lines, per month",
        pricingKey: pk,
      });
      continue;
    }

    if (kind === "archive") {
      const tbMo = Math.round(effTbMo * 1000) / 1000;
      rows.push({
        ...base,
        nodeLabel: node.data.label,
        displayType: "Archive",
        skuKey: "archive",
        description: "Archive",
        quantityPerMonth: tbMo,
        unitPrice: 0,
        monthly: 0,
        annual: 0,
        millionLinesNote: "TB/mo",
      });
      continue;
    }

    rows.push({
      ...base,
      nodeLabel: node.data.label,
      displayType: "Ingest",
      description: "—",
      quantityPerMonth: null,
      unitPrice: null,
      monthly: null,
      annual: null,
      millionLinesNote: "",
    });
  }

  if (hasFlexNode && flexLeaves.length > 0 && !flexStorageRowAdded) {
    rows.push(buildFlexStorageLineItem());
  }

  if (hasFlexNode) {
    const pk = flexTierToPricingKey(p.flexComputeTier);
    const m = resolvePrice(pk, ov);
    rows.push({
      id: "flex-compute",
      lineKind: "flex_compute",
      displayType: "Flex Compute",
      skuKey: "flex_compute",
      nodeLabel: "",
      pctOfTotal: null,
      description: `Flex Compute ${p.flexComputeTier.toUpperCase()}`,
      quantityPerMonth: null,
      unitPrice: m,
      monthly: m,
      annual: annual(m),
      millionLinesNote: "Monthly list",
      pricingKey: pk,
    });
  }

  return rows;
}
