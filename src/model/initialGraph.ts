import type { StrategyEdge, StrategyNode } from "./types";

/** Default layout inspired by the reference diagram */
export function createInitialGraph(): {
  nodes: StrategyNode[];
  edges: StrategyEdge[];
} {
  const rootNodeId = "n_source";

  const nodes: StrategyNode[] = [
    {
      id: rootNodeId,
      type: "strategy",
      position: { x: 400, y: 120 },
      data: {
        kind: "source",
        label: "Source",
        totalTbPerMonth: 30,
        millionLinesPerMonth: 30_000,
      },
    },
    {
      id: "n_pipelines",
      type: "strategy",
      position: { x: 400, y: 260 },
      data: {
        kind: "pipelines",
        label: "Datadog Observability Pipelines",
      },
    },
    {
      id: "n_ingest",
      type: "strategy",
      position: { x: 200, y: 400 },
      data: {
        kind: "ingest",
        label: "Datadog | Ingest",
      },
    },
    {
      id: "n_s3",
      type: "strategy",
      position: { x: 600, y: 400 },
      data: {
        kind: "archive",
        label: "AWS S3 | Cloud Storage",
      },
    },
    {
      id: "n_index",
      type: "strategy",
      position: { x: 80, y: 560 },
      data: {
        kind: "index",
        label: "3-Day Index (Warning+)",
        retentionDays: 3,
        tierLabel: "Standard",
      },
    },
    {
      id: "n_flex",
      type: "strategy",
      position: { x: 360, y: 560 },
      data: {
        kind: "flex",
        label: "Datadog Flex Logs",
        flexRetentionDays: 30,
      },
    },
  ];

  const edges: StrategyEdge[] = [
    {
      id: "e_source_pipelines",
      source: rootNodeId,
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
      id: "e_ingest_flex",
      source: "n_ingest",
      target: "n_flex",
      type: "pct",
      data: { pct: 80 },
    },
  ];

  return { nodes, edges };
}
