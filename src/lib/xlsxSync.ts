import * as XLSX from "xlsx";
import { finiteNonNegative, sourceNodeIdsSorted } from "@/model/graphMath";
import { buildSheetLineItems } from "@/model/sheetLineItems";
import {
  DEFAULT_MILLION_LINES_PER_MONTH,
  DEFAULT_TOTAL_TB_PER_MONTH,
} from "@/model/volumeDefaults";
import type { FlexComputeTier, PricingKey } from "@/model/pricingCatalog";
import type {
  LineItem,
  NodeKind,
  StrategyEdge,
  StrategyNode,
} from "@/model/types";
import type { StrategyStore } from "@/state/strategyStore";

const MODEL_SHEET = "_strategy_model";
const COSTS_SHEET = "Costs";

const HEADERS = [
  "% of Total Logs",
  "Name",
  "Description",
  "Quantity Per Month",
  "Price (unit)",
  "Monthly",
  "Annual",
  "Notes",
  "skuKey",
] as const;

/** Older exports used pipeline/split kinds */
function migrateImportedNodes(nodes: StrategyNode[]): StrategyNode[] {
  return nodes.map((n) => {
    const raw = n.data?.kind as string | undefined;
    let kind: NodeKind = n.data.kind;
    if (raw === "pipeline") kind = "pipelines";
    if (raw === "split") kind = "ingest";
    return {
      ...n,
      data: { ...n.data, kind },
    };
  });
}

/** Legacy graphs used `source` at the root for both volume + OP; split into source + pipelines. */
function migrateLegacySourceOpSplit(
  nodes: StrategyNode[],
  edges: StrategyEdge[],
  rootNodeId: string
): { nodes: StrategyNode[]; edges: StrategyEdge[]; rootNodeId: string } {
  if (nodes.some((n) => n.data.kind === "pipelines")) {
    return { nodes, edges, rootNodeId };
  }
  const root = nodes.find((n) => n.id === rootNodeId);
  if (!root || root.data.kind !== "source") {
    return { nodes, edges, rootNodeId };
  }
  const newRootId = `${rootNodeId}_mig_src`;
  const newSource: StrategyNode = {
    id: newRootId,
    type: "strategy",
    position: { x: root.position.x, y: root.position.y - 140 },
    data: {
      kind: "source",
      label: "Source",
      totalTbPerMonth: DEFAULT_TOTAL_TB_PER_MONTH,
      millionLinesPerMonth: DEFAULT_MILLION_LINES_PER_MONTH,
    },
  };
  const pipelinesLabel =
    root.data.label && !/^\s*source\s*$/i.test(root.data.label)
      ? root.data.label
      : "Datadog Observability Pipelines";
  const updatedRoot: StrategyNode = {
    ...root,
    data: {
      ...root.data,
      kind: "pipelines",
      label: pipelinesLabel,
    },
  };
  const updatedNodes = nodes.map((n) =>
    n.id === root.id ? updatedRoot : n
  );
  updatedNodes.push(newSource);
  const newEdge: StrategyEdge = {
    id: `e_mig_${newRootId}_${root.id}`,
    source: newRootId,
    target: root.id,
    type: "pct",
    data: { pct: 100 },
  };
  return {
    nodes: updatedNodes,
    edges: [...edges, newEdge],
    rootNodeId: newRootId,
  };
}

/** v1–2 files stored TB + million lines globally; merge into the first source missing data. */
function migrateLegacyVolumeIntoSourceNodes(
  nodes: StrategyNode[],
  legacyTb: number | undefined,
  legacyLines: number | undefined
): StrategyNode[] {
  const fillTb = finiteNonNegative(legacyTb, DEFAULT_TOTAL_TB_PER_MONTH);
  const fillLines = finiteNonNegative(
    legacyLines,
    DEFAULT_MILLION_LINES_PER_MONTH
  );
  const sortedSourceIds = [...nodes]
    .filter((n) => n.data.kind === "source")
    .map((n) => n.id)
    .sort((a, b) => a.localeCompare(b));
  const primaryToFill = sortedSourceIds[0];
  return nodes.map((n) => {
    if (n.data.kind !== "source") return n;
    const hasTb =
      typeof n.data.totalTbPerMonth === "number" &&
      Number.isFinite(n.data.totalTbPerMonth);
    const hasLines =
      typeof n.data.millionLinesPerMonth === "number" &&
      Number.isFinite(n.data.millionLinesPerMonth);
    if (hasTb && hasLines) return n;
    const useLegacy = n.id === primaryToFill;
    return {
      ...n,
      data: {
        ...n.data,
        totalTbPerMonth: hasTb
          ? n.data.totalTbPerMonth
          : useLegacy
            ? fillTb
            : DEFAULT_TOTAL_TB_PER_MONTH,
        millionLinesPerMonth: hasLines
          ? n.data.millionLinesPerMonth
          : useLegacy
            ? fillLines
            : DEFAULT_MILLION_LINES_PER_MONTH,
      },
    };
  });
}

function lineItemToRow(row: LineItem): (string | number | null)[] {
  return [
    row.pctOfTotal ?? "",
    row.nodeLabel ?? "",
    row.description,
    row.quantityPerMonth ?? "",
    row.unitPrice ?? "",
    row.monthly ?? "",
    row.annual ?? "",
    row.millionLinesNote,
    row.skuKey ?? "",
  ];
}

export function exportStrategyXlsx(
  state: Pick<
    StrategyStore,
    | "nodes"
    | "edges"
    | "sheetLineItems"
    | "pricingOverrides"
    | "flexComputeTier"
  >,
  filename: string
): void {
  const wb = XLSX.utils.book_new();

  const allRows: (string | number | null)[][] = [
    [...HEADERS],
    ...state.sheetLineItems.map(lineItemToRow),
  ];

  const totals = state.sheetLineItems.reduce(
    (acc, r) => ({
      m: acc.m + (r.monthly ?? 0),
      a: acc.a + (r.annual ?? 0),
    }),
    { m: 0, a: 0 }
  );
  allRows.push([
    "",
    "",
    "Total",
    "",
    "",
    Math.round(totals.m * 100) / 100,
    Math.round(totals.a * 100) / 100,
    "",
    "",
  ]);

  const ws = XLSX.utils.aoa_to_sheet(allRows);
  XLSX.utils.book_append_sheet(wb, ws, COSTS_SHEET);

  const payload = {
    v: 3 as const,
    nodes: state.nodes as StrategyNode[],
    edges: state.edges as StrategyEdge[],
    pricingOverrides: state.pricingOverrides,
    flexComputeTier: state.flexComputeTier,
  };
  const wsModel = XLSX.utils.aoa_to_sheet([[JSON.stringify(payload)]]);
  XLSX.utils.book_append_sheet(wb, wsModel, MODEL_SHEET);

  XLSX.writeFile(wb, filename);
}

type SetState = (
  partial:
    | Partial<StrategyStore>
    | ((state: StrategyStore) => Partial<StrategyStore>)
) => void;

export async function importStrategyXlsx(
  file: File,
  setState: SetState
): Promise<void> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });

  const modelSheet = wb.Sheets[MODEL_SHEET];
  if (modelSheet) {
    const raw = XLSX.utils.sheet_to_json<string[]>(modelSheet, {
      header: 1,
    });
    const cell = raw[0]?.[0];
    if (typeof cell === "string" && cell.startsWith("{")) {
      const parsed = JSON.parse(cell) as {
        v: number;
        rootNodeId?: string;
        totalTbPerMonth?: number;
        /** @deprecated Import only; exports used total TB/day before TB/month. */
        totalTbPerDay?: number;
        millionLinesPerMonth?: number;
        nodes: StrategyNode[];
        edges: StrategyEdge[];
        pricingOverrides?: Partial<Record<PricingKey, number>>;
        flexComputeTier?: FlexComputeTier;
      };
      const pricingOverrides = parsed.pricingOverrides ?? {};
      const flexComputeTier = parsed.flexComputeTier ?? "sm";
      const legacyTbRaw =
        parsed.totalTbPerMonth ??
        (parsed.totalTbPerDay != null ? parsed.totalTbPerDay * 30 : undefined);
      const legacyTb = finiteNonNegative(
        legacyTbRaw,
        DEFAULT_TOTAL_TB_PER_MONTH
      );
      const legacyLines = finiteNonNegative(
        parsed.millionLinesPerMonth,
        DEFAULT_MILLION_LINES_PER_MONTH
      );
      let nodes = migrateImportedNodes(parsed.nodes);
      let edges = parsed.edges;
      const rootForLegacy =
        parsed.rootNodeId ?? sourceNodeIdsSorted(nodes)[0] ?? "";
      if (rootForLegacy) {
        const split = migrateLegacySourceOpSplit(nodes, edges, rootForLegacy);
        nodes = split.nodes;
        edges = split.edges;
      }
      nodes = migrateLegacyVolumeIntoSourceNodes(nodes, legacyTb, legacyLines);
      const sheetLineItems = buildSheetLineItems({
        nodes,
        edges,
        pricingOverrides,
        flexComputeTier,
      });
      setState({
        nodes,
        edges,
        pricingOverrides,
        flexComputeTier,
        sheetLineItems,
        sheetConflicts: [],
        selectedNodeId: null,
      });
      return;
    }
  }

  setState({
    sheetConflicts: [
      "No _strategy_model sheet found — export a full workbook from this app first.",
    ],
  });
}
