import type { Edge, Node } from "@xyflow/react";
import type { PricingKey } from "./pricingCatalog";

export type NodeKind =
  | "source"
  | "pipelines"
  | "siem"
  | "ingest"
  | "flex_compute"
  | "flex"
  | "flex_starter"
  | "index"
  | "archive"
  | "archive_search"
  | "group";

export interface StrategyNodeData extends Record<string, unknown> {
  kind: NodeKind;
  label: string;
  /** Source nodes: total log volume (TB/month) driving downstream math */
  totalTbPerMonth?: number;
  /** Source nodes: million log lines per month */
  millionLinesPerMonth?: number;
  /** Indexed logs: hot retention in days */
  retentionDays?: number;
  /** e.g. "Standard 3-day" */
  tierLabel?: string;
  /** Flex: retention days shown in sheet */
  flexRetentionDays?: number;
  /** Group: persistent color used on the canvas + spend bar so each group is distinct. */
  groupColor?: string;
}

export type StrategyNode = Node<StrategyNodeData>;
export type StrategyEdgeData = { pct: number };
export type StrategyEdge = Edge<StrategyEdgeData>;

/** Sheet row: graph node, aggregated flex storage, or flex compute SKU */
export type SheetLineKind = "node" | "flex_aggregate" | "flex_compute";

/** Cost sheet “Type” column (OP, Ingest, …) */
export type SheetDisplayType =
  | "OP"
  | "SIEM"
  | "Ingest"
  | "Flex Storage"
  | "Flex Compute"
  | "Flex Starter"
  | "Standard"
  | "Archive"
  | "Archive Search";

export interface LineItem {
  id: string;
  lineKind: SheetLineKind;
  displayType: SheetDisplayType;
  /** Stable key for export / overrides */
  skuKey?: string;
  pctOfTotal: number | null;
  /** Short product line (e.g. Standard Index 3, Flex Storage 30) */
  description: string;
  /** Graph node label (user-facing name); “Name” column before Description in UI/export */
  nodeLabel?: string;
  quantityPerMonth: number | null;
  unitPrice: number | null;
  monthly: number | null;
  annual: number | null;
  millionLinesNote: string;
  /** Node rows, or flex aggregate when exactly one Flex leaf (sheet % + retention) */
  routeNodeId?: string;
  /** Which catalog key the Unit $ maps to (for overrides / reset) */
  pricingKey?: PricingKey;
  /** Group node id this row belongs to (children of a group node on the canvas) */
  groupId?: string;
  /** Group label (cached for display so consumers don't need the nodes array) */
  groupName?: string;
  /** Per-group color (cached so the spend bar / sheet styling can reuse it) */
  groupColor?: string;
}

export interface SplitValidation {
  nodeId: string;
  label: string;
  sumPct: number;
  ok: boolean;
}
