import type { StrategyEdge, StrategyNode } from "./types";

export type LayoutOrientation = "horizontal" | "vertical";

/**
 * Stage layout: each node is placed at (col, row) on a regular grid; horizontal
 * orientation maps col→x and row→y; vertical swaps them. Keeping the model
 * orientation-agnostic means a re-layout is just a coordinate transform.
 */
interface StagePos {
  col: number;
  row: number;
}

const STAGES: { id: string; pos: StagePos; data: StrategyNode["data"] }[] = [
  {
    id: "n_source",
    pos: { col: 0, row: 2 },
    data: {
      kind: "source",
      label: "Source",
      totalTbPerMonth: 30,
      millionLinesPerMonth: 30_000,
    },
  },
  {
    id: "n_pipelines",
    pos: { col: 1, row: 2 },
    data: {
      kind: "pipelines",
      label: "Datadog Observability Pipelines",
    },
  },
  {
    id: "n_ingest",
    pos: { col: 2, row: 1 },
    data: {
      kind: "ingest",
      label: "Datadog | Ingest",
    },
  },
  {
    id: "n_s3",
    pos: { col: 2, row: 3 },
    data: {
      kind: "archive",
      label: "AWS S3 | Cloud Storage",
    },
  },
  {
    id: "n_index",
    pos: { col: 3, row: 0 },
    data: {
      kind: "index",
      label: "3-Day Index (Warning+)",
      retentionDays: 3,
      tierLabel: "Standard",
    },
  },
  {
    id: "n_flex_compute",
    pos: { col: 3, row: 2 },
    data: {
      kind: "flex_compute",
      label: "Flex Compute",
    },
  },
  {
    id: "n_flex",
    pos: { col: 4, row: 2 },
    data: {
      kind: "flex",
      label: "Datadog Flex Logs",
      flexRetentionDays: 30,
    },
  },
];

const BASE = 80;
const COL_GAP = 220;
const ROW_GAP = 140;

function gridToPosition(
  pos: StagePos,
  orientation: LayoutOrientation
): { x: number; y: number } {
  if (orientation === "horizontal") {
    return { x: BASE + pos.col * COL_GAP, y: BASE + pos.row * ROW_GAP };
  }
  // Vertical: rows become x (lateral spread), cols become y (down the flow).
  return { x: BASE + pos.row * COL_GAP, y: BASE + pos.col * ROW_GAP };
}

/**
 * Re-layout existing nodes when the user toggles orientation. We swap x↔y but
 * also scale by COL_GAP/ROW_GAP so spacing along the new flow direction stays
 * generous (otherwise nodes that were 220px apart along the flow end up 140px
 * apart, leaving edges crowded). The transform is its own inverse, so toggling
 * twice returns to the original layout.
 */
export function rotateNodePositions(nodes: StrategyNode[]): StrategyNode[] {
  const sx = COL_GAP / ROW_GAP;
  const sy = ROW_GAP / COL_GAP;
  return nodes.map((n) => ({
    ...n,
    position: {
      x: BASE + (n.position.y - BASE) * sx,
      y: BASE + (n.position.x - BASE) * sy,
    },
  }));
}

/** Default layout inspired by the reference diagram */
export function createInitialGraph(
  orientation: LayoutOrientation = "horizontal"
): {
  nodes: StrategyNode[];
  edges: StrategyEdge[];
} {
  const nodes: StrategyNode[] = STAGES.map((s) => ({
    id: s.id,
    type: "strategy",
    position: gridToPosition(s.pos, orientation),
    data: s.data,
  }));

  const edges: StrategyEdge[] = [
    {
      id: "e_source_pipelines",
      source: "n_source",
      target: "n_pipelines",
      type: "pct",
      data: { pct: 100 },
    },
    {
      id: "e_pipelines_ingest",
      source: "n_pipelines",
      target: "n_ingest",
      type: "pct",
      data: { pct: 40 },
    },
    {
      id: "e_pipelines_s3",
      source: "n_pipelines",
      target: "n_s3",
      type: "pct",
      data: { pct: 60 },
    },
    {
      id: "e_ingest_index",
      source: "n_ingest",
      target: "n_index",
      type: "pct",
      data: { pct: 20 },
    },
    {
      id: "e_ingest_flex_compute",
      source: "n_ingest",
      target: "n_flex_compute",
      type: "pct",
      data: { pct: 80 },
    },
    {
      id: "e_flex_compute_flex",
      source: "n_flex_compute",
      target: "n_flex",
      type: "pct",
      data: { pct: 100 },
    },
  ];

  return { nodes, edges };
}
