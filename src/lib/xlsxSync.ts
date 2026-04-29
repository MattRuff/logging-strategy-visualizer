import ExcelJS from "exceljs";
import {
  computeNodeVolumes,
  finiteNonNegative,
  sourceNodeIdsSorted,
} from "@/model/graphMath";
import { nearestFlexRetentionDays } from "@/model/flexRetention";
import { buildSheetLineItems } from "@/model/sheetLineItems";
import {
  DEFAULT_MILLION_LINES_PER_MONTH,
  DEFAULT_TOTAL_TB_PER_MONTH,
} from "@/model/volumeDefaults";
import {
  pickFlexComputeTier,
  type FlexComputeTier,
  type PricingKey,
} from "@/model/pricingCatalog";
import type {
  LineItem,
  NodeKind,
  StrategyEdge,
  StrategyNode,
} from "@/model/types";
import { enforceFlexComputeInvariant } from "@/model/flexInvariant";
import {
  genId,
  reseedIdCounter,
  type StrategyStore,
} from "@/state/strategyStore";

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

/** Trigger a browser download for a Blob without pulling in a file-saver dep. */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Defer revoke so the navigation has time to start before we drop the URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportStrategyXlsx(
  state: Pick<
    StrategyStore,
    | "nodes"
    | "edges"
    | "sheetLineItems"
    | "pricingOverrides"
    | "flexComputeTier"
    | "layoutOrientation"
  >,
  filename: string
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(COSTS_SHEET);

  ws.addRow([...HEADERS]);
  for (const row of state.sheetLineItems) {
    ws.addRow(lineItemToRow(row));
  }

  const totals = state.sheetLineItems.reduce(
    (acc, r) => ({
      m: acc.m + (r.monthly ?? 0),
      a: acc.a + (r.annual ?? 0),
    }),
    { m: 0, a: 0 }
  );
  ws.addRow([
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

  const payload = {
    v: 3 as const,
    nodes: state.nodes as StrategyNode[],
    edges: state.edges as StrategyEdge[],
    pricingOverrides: state.pricingOverrides,
    flexComputeTier: state.flexComputeTier,
    layoutOrientation: state.layoutOrientation,
  };
  const wsModel = wb.addWorksheet(MODEL_SHEET);
  wsModel.getCell(1, 1).value = JSON.stringify(payload);

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, filename);
}

type SetState = (
  partial:
    | Partial<StrategyStore>
    | ((state: StrategyStore) => Partial<StrategyStore>)
) => void;

/** Strip dangerous keys during JSON.parse to avoid prototype pollution from untrusted files. */
function safeJsonParse<T = unknown>(text: string): T {
  return JSON.parse(text, (key, value) => {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      return undefined;
    }
    return value;
  }) as T;
}

/** Reject imports whose node/edge shapes don't match our expected strategy graph. */
function validateImportShape(parsed: unknown): parsed is {
  v: number;
  rootNodeId?: string;
  totalTbPerMonth?: number;
  totalTbPerDay?: number;
  millionLinesPerMonth?: number;
  nodes: StrategyNode[];
  edges: StrategyEdge[];
  pricingOverrides?: Partial<Record<PricingKey, number>>;
  flexComputeTier?: FlexComputeTier;
  layoutOrientation?: "horizontal" | "vertical";
} {
  if (!parsed || typeof parsed !== "object") return false;
  const p = parsed as Record<string, unknown>;
  if (!Array.isArray(p.nodes) || !Array.isArray(p.edges)) return false;
  for (const n of p.nodes) {
    if (!n || typeof n !== "object") return false;
    const nn = n as Record<string, unknown>;
    if (typeof nn.id !== "string") return false;
    if (!nn.data || typeof nn.data !== "object") return false;
    const d = nn.data as Record<string, unknown>;
    if (typeof d.kind !== "string") return false;
  }
  for (const e of p.edges) {
    if (!e || typeof e !== "object") return false;
    const ee = e as Record<string, unknown>;
    if (
      typeof ee.id !== "string" ||
      typeof ee.source !== "string" ||
      typeof ee.target !== "string"
    ) {
      return false;
    }
  }
  return true;
}

/** Pull the JSON payload cell out of the model sheet, handling string + richText values. */
function readModelCell(ws: ExcelJS.Worksheet): string | null {
  const cell = ws.getCell(1, 1).value;
  if (typeof cell === "string") return cell;
  if (cell && typeof cell === "object") {
    const rich = (cell as { richText?: Array<{ text?: string }> }).richText;
    if (Array.isArray(rich)) {
      return rich.map((r) => r.text ?? "").join("");
    }
    const text = (cell as { text?: string }).text;
    if (typeof text === "string") return text;
  }
  return null;
}

export async function importStrategyXlsx(
  file: File,
  setState: SetState
): Promise<void> {
  const buf = await file.arrayBuffer();
  await importStrategyXlsxFromBuffer(buf, setState);
}

export async function importStrategyXlsxFromBuffer(
  buf: ArrayBuffer,
  setState: SetState
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf);
  } catch {
    setState({
      sheetConflicts: [
        "Could not read the selected file; is it a valid .xlsx workbook?",
      ],
    });
    return;
  }

  const modelSheet = wb.getWorksheet(MODEL_SHEET);
  if (!modelSheet) {
    setState({
      sheetConflicts: [
        "No _strategy_model sheet found — export a full workbook from this app first.",
      ],
    });
    return;
  }

  const cellStr = readModelCell(modelSheet);
  if (!cellStr || !cellStr.startsWith("{")) {
    setState({
      sheetConflicts: [
        "Model sheet is empty or unrecognized — re-export from this app.",
      ],
    });
    return;
  }

  let parsedUnknown: unknown;
  try {
    parsedUnknown = safeJsonParse(cellStr);
  } catch {
    setState({
      sheetConflicts: ["Model JSON is malformed; import aborted."],
    });
    return;
  }
  if (!validateImportShape(parsedUnknown)) {
    setState({
      sheetConflicts: [
        "Imported model failed validation; expected strategy-graph nodes/edges.",
      ],
    });
    return;
  }
  const parsed = parsedUnknown;

  const pricingOverrides = parsed.pricingOverrides ?? {};
  const legacyTbRaw =
    parsed.totalTbPerMonth ??
    (parsed.totalTbPerDay != null ? parsed.totalTbPerDay * 30 : undefined);
  const legacyTb = finiteNonNegative(legacyTbRaw, DEFAULT_TOTAL_TB_PER_MONTH);
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
  // Reseed the id counter so later adds cannot clash with imported IDs.
  reseedIdCounter(nodes, edges);
  // Synthesize flex_compute parent for pre-feature exports (idempotent).
  const enforced = enforceFlexComputeInvariant(nodes, edges, genId);
  nodes = enforced.nodes;
  edges = enforced.edges;
  // Auto-derive compute tier from retention-weighted flex storage events.
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
    pricingOverrides,
    flexComputeTier,
    nodeVolumes,
  });
  setState({
    nodes,
    edges,
    pricingOverrides,
    flexComputeTier,
    layoutOrientation: parsed.layoutOrientation ?? "horizontal",
    nodeVolumes,
    sheetLineItems,
    sheetConflicts: [],
    selectedNodeId: null,
  });
}
