import {
  computeLeafVolumesFromSources,
  computeNodeVolumes,
  type NodeVolume,
  orderedBfsFromSources,
  sumSourceTbPerMonth,
  tbPerDayToTbPerMonth,
  tbPerMonthToTbPerDay,
} from "./graphMath";
import {
  type FlexComputeTier,
  flexTierToPricingKey,
  GB_PER_TB,
  indexedRetentionToKey,
  resolvePrice,
  siemTierForTb,
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
  /** Optional precomputed volume map; if omitted we compute it once here. */
  nodeVolumes?: Map<string, NodeVolume>;
}

const ZERO_VOLUME: NodeVolume = { tbPerMonth: 0, millionLinesPerMonth: 0 };

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
  const volumes = p.nodeVolumes ?? computeNodeVolumes(nodes, edges);

  const hasFlexNode = nodes.some((n) => n.data?.kind === "flex");
  const flexLeaves = computeLeafVolumesFromSources(nodes, edges).filter(
    (lv) => lv.kind === "flex"
  );

  function buildFlexStorageLineItem(): LineItem {
    const bucketRate = resolvePrice("flex_bucket_per_30d", ov);
    let flexMonthly = 0;
    let totalMLines = 0;
    let totalTbMo = 0;
    for (const lv of flexLeaves) {
      const n = nodeById.get(lv.nodeId);
      const days = nearestFlexRetentionDays(n?.data?.flexRetentionDays ?? 30);
      const mLines = volumes.get(lv.nodeId)?.millionLinesPerMonth ?? 0;
      const buckets = days / 30;
      flexMonthly += mLines * bucketRate * buckets;
      totalMLines += mLines;
      totalTbMo += tbPerDayToTbPerMonth(lv.tbPerDay);
    }
    flexMonthly = Math.round(flexMonthly * 100) / 100;
    const effUnit =
      totalMLines > 0
        ? Math.round((flexMonthly / totalMLines) * 10000) / 10000
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

    const aggregateGroup = routeNodeId ? groupForNode(routeNodeId) : undefined;
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
      quantityPerMonth: Math.round(totalMLines * 1000) / 1000,
      unitPrice: effUnit,
      monthly: flexMonthly,
      annual: annual(flexMonthly),
      millionLinesNote: "M lines/mo · blended $/Mlines-30d",
      pricingKey: "flex_bucket_per_30d",
      groupId: aggregateGroup?.id,
      groupName: aggregateGroup?.label,
      groupColor: aggregateGroup?.color,
    };
  }

  function groupForNode(
    nid: string
  ): { id: string; label: string; color?: string } | undefined {
    const n = nodeById.get(nid);
    if (!n?.parentId) return undefined;
    const parent = nodeById.get(n.parentId);
    if (!parent || parent.type !== "group") return undefined;
    return {
      id: parent.id,
      label: parent.data?.label ?? "Group",
      color: parent.data?.groupColor,
    };
  }

  const rows: LineItem[] = [];
  let flexStorageRowAdded = false;

  for (const nodeId of order) {
    const node = nodeById.get(nodeId);
    if (!node) continue;
    const kind = node.data.kind;
    // Group containers don't appear in the cost sheet; their children do.
    if (kind === "group") continue;
    const vol = volumes.get(nodeId) ?? ZERO_VOLUME;
    const effTbMo = vol.tbPerMonth;
    const effMLines = vol.millionLinesPerMonth;
    const pct =
      sumTbMo > 0
        ? Math.round((effTbMo / sumTbMo) * 100000) / 1000
        : 0;

    const grp = groupForNode(nodeId);
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
      groupId: grp?.id,
      groupName: grp?.label,
      groupColor: grp?.color,
    };

    if (kind === "flex") {
      if (!flexStorageRowAdded && flexLeaves.length > 0) {
        flexStorageRowAdded = true;
        rows.push(buildFlexStorageLineItem());
      }
      continue;
    }

    // flex_compute is rendered as the global Flex Compute row appended below;
    // skip generic per-node emission to avoid a duplicate "—" row.
    if (kind === "flex_compute") continue;

    if (kind === "source") {
      continue;
    }

    if (kind === "pipelines") {
      const effTbDay = tbPerMonthToTbPerDay(effTbMo);
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

    if (kind === "siem") {
      const tbMo = Math.round(effTbMo * 1000) / 1000;
      const tier = siemTierForTb(tbMo);
      const unit = resolvePrice(tier.key, ov);
      const gbMo = tbMo * GB_PER_TB;
      const monthly = Math.round(gbMo * unit * 100) / 100;
      rows.push({
        ...base,
        nodeLabel: node.data.label,
        displayType: "SIEM",
        skuKey: "siem_ingest",
        description: `SIEM (${tier.label})`,
        quantityPerMonth: Math.round(gbMo * 1000) / 1000,
        unitPrice: unit,
        monthly,
        annual: annual(monthly),
        millionLinesNote: "GB/mo · tier $/GB",
        pricingKey: tier.key,
      });
      continue;
    }

    if (kind === "ingest") {
      const q = Math.round(effMLines * 1000) / 1000;
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
      const q = Math.round(effMLines * 1000) / 1000;
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

    if (kind === "archive_search") {
      const tbMo = effTbMo;
      const gbMo = tbMo * GB_PER_TB;
      const unit = resolvePrice("archive_search_per_gb", ov);
      const monthly = Math.round(gbMo * unit * 100) / 100;
      rows.push({
        ...base,
        nodeLabel: node.data.label,
        displayType: "Archive Search",
        skuKey: "archive_search",
        description: "Archive Search",
        quantityPerMonth: Math.round(gbMo * 1000) / 1000,
        unitPrice: unit,
        monthly,
        annual: annual(monthly),
        millionLinesNote: "GB scanned/mo",
        pricingKey: "archive_search_per_gb",
      });
      continue;
    }

    if (kind === "flex_starter") {
      const days = nearestFlexRetentionDays(
        node.data.flexRetentionDays ?? 30
      );
      const mLines = Math.round(effMLines * 1000) / 1000;
      const unit = resolvePrice("flex_starter_per_million_30d", ov);
      const buckets = days / 30;
      const monthly = Math.round(mLines * unit * buckets * 100) / 100;
      rows.push({
        ...base,
        nodeLabel: node.data.label,
        displayType: "Flex Starter",
        skuKey: "flex_starter",
        description: `Flex Starter ${days}d`,
        quantityPerMonth: mLines,
        unitPrice: unit,
        monthly,
        annual: annual(monthly),
        millionLinesNote: "M lines/mo · $/M-30d",
        pricingKey: "flex_starter_per_million_30d",
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
    const computeNode = nodes.find((n) => n.data?.kind === "flex_compute");
    // Tag the flex-compute row with a group when every flex leaf shares the same
    // group (the Flex Storage aggregate gets the same treatment via routeNodeId).
    // Falls back to ungrouped if leaves span multiple groups.
    const flexLeafGroups = flexLeaves
      .map((lv) => groupForNode(lv.nodeId)?.id)
      .filter((g): g is string => !!g);
    const allFlexLeavesGrouped =
      flexLeaves.length > 0 && flexLeafGroups.length === flexLeaves.length;
    const sharedGroupId =
      allFlexLeavesGrouped && new Set(flexLeafGroups).size === 1
        ? flexLeafGroups[0]
        : undefined;
    const sharedGroup = sharedGroupId
      ? {
          id: sharedGroupId,
          label: nodeById.get(sharedGroupId)?.data?.label ?? "Group",
          color: nodeById.get(sharedGroupId)?.data?.groupColor,
        }
      : undefined;
    // Also retroactively tag the flex aggregate with the shared group when
    // there were multiple flex leaves (which wouldn't have a routeNodeId).
    if (sharedGroup) {
      const aggIdx = rows.findIndex((r) => r.lineKind === "flex_aggregate");
      if (aggIdx !== -1 && !rows[aggIdx].groupId) {
        rows[aggIdx] = {
          ...rows[aggIdx],
          groupId: sharedGroup.id,
          groupName: sharedGroup.label,
          groupColor: sharedGroup.color,
        };
      }
    }

    rows.push({
      id: "flex-compute",
      lineKind: "flex_compute",
      displayType: "Flex Compute",
      skuKey: "flex_compute",
      nodeLabel: computeNode?.data.label ?? "",
      routeNodeId: computeNode?.id,
      pctOfTotal: null,
      description: `Flex Compute ${p.flexComputeTier.toUpperCase()}`,
      quantityPerMonth: null,
      unitPrice: m,
      monthly: m,
      annual: annual(m),
      millionLinesNote: "Monthly list",
      pricingKey: pk,
      groupId: sharedGroup?.id,
      groupName: sharedGroup?.label,
      groupColor: sharedGroup?.color,
    });
  }

  return rows;
}
