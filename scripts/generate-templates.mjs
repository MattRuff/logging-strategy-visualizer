// Regenerate the seed strategy templates under public/templates/.
// These files match the schema produced by the app's Export .xlsx button: a
// Costs sheet (placeholder here) plus a _strategy_model sheet whose A1 cell
// holds the JSON payload the importer reads.
//
// Usage: node scripts/generate-templates.mjs

import ExcelJS from "exceljs";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "public", "templates");
mkdirSync(outDir, { recursive: true });

/**
 * @typedef {{
 *   v: 3,
 *   nodes: Array<{id:string, type:"strategy", position:{x:number,y:number}, data: any}>,
 *   edges: Array<{id:string, source:string, target:string, type:"pct", data:{pct:number}}>,
 *   pricingOverrides: Record<string, number>,
 *   flexComputeTier: "sm"|"md"|"lg"
 * }} Payload
 */

/** @type {Payload} */
const flexHeavyArchive = {
  v: 3,
  flexComputeTier: "md",
  pricingOverrides: {},
  nodes: [
    {
      id: "n_source",
      type: "strategy",
      position: { x: 400, y: 120 },
      data: {
        kind: "source",
        label: "Source",
        totalTbPerMonth: 60,
        millionLinesPerMonth: 60_000,
      },
    },
    {
      id: "n_pipelines",
      type: "strategy",
      position: { x: 400, y: 260 },
      data: { kind: "pipelines", label: "Datadog Observability Pipelines" },
    },
    {
      id: "n_ingest",
      type: "strategy",
      position: { x: 240, y: 400 },
      data: { kind: "ingest", label: "Datadog | Ingest" },
    },
    {
      id: "n_archive",
      type: "strategy",
      position: { x: 620, y: 400 },
      data: { kind: "archive", label: "AWS S3 | Archive" },
    },
    {
      id: "n_flex",
      type: "strategy",
      position: { x: 140, y: 560 },
      data: {
        kind: "flex",
        label: "Flex Logs 180d",
        flexRetentionDays: 180,
      },
    },
    {
      id: "n_index",
      type: "strategy",
      position: { x: 380, y: 560 },
      data: {
        kind: "index",
        label: "3-Day Index (Warning+)",
        retentionDays: 3,
        tierLabel: "Standard",
      },
    },
  ],
  edges: [
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
      data: { pct: 70 },
    },
    {
      id: "e_pipelines_archive",
      source: "n_pipelines",
      target: "n_archive",
      type: "pct",
      data: { pct: 30 },
    },
    {
      id: "e_ingest_flex",
      source: "n_ingest",
      target: "n_flex",
      type: "pct",
      data: { pct: 80 },
    },
    {
      id: "e_ingest_index",
      source: "n_ingest",
      target: "n_index",
      type: "pct",
      data: { pct: 20 },
    },
  ],
};

/** @type {Payload} */
const indexedFirstLowVolume = {
  v: 3,
  flexComputeTier: "sm",
  pricingOverrides: {},
  nodes: [
    {
      id: "n_source",
      type: "strategy",
      position: { x: 400, y: 120 },
      data: {
        kind: "source",
        label: "Source",
        totalTbPerMonth: 3,
        millionLinesPerMonth: 3_000,
      },
    },
    {
      id: "n_ingest",
      type: "strategy",
      position: { x: 400, y: 280 },
      data: { kind: "ingest", label: "Datadog | Ingest" },
    },
    {
      id: "n_index",
      type: "strategy",
      position: { x: 400, y: 440 },
      data: {
        kind: "index",
        label: "15-Day Index",
        retentionDays: 15,
        tierLabel: "Standard",
      },
    },
  ],
  edges: [
    {
      id: "e_source_ingest",
      source: "n_source",
      target: "n_ingest",
      type: "pct",
      data: { pct: 100 },
    },
    {
      id: "e_ingest_index",
      source: "n_ingest",
      target: "n_index",
      type: "pct",
      data: { pct: 100 },
    },
  ],
};

/** @type {Payload} */
const tieredOpsPipeline = {
  v: 3,
  flexComputeTier: "md",
  pricingOverrides: {},
  nodes: [
    {
      id: "n_source",
      type: "strategy",
      position: { x: 400, y: 120 },
      data: {
        kind: "source",
        label: "Source",
        totalTbPerMonth: 45,
        millionLinesPerMonth: 45_000,
      },
    },
    {
      id: "n_pipelines",
      type: "strategy",
      position: { x: 400, y: 260 },
      data: { kind: "pipelines", label: "Datadog Observability Pipelines" },
    },
    {
      id: "n_ingest",
      type: "strategy",
      position: { x: 260, y: 400 },
      data: { kind: "ingest", label: "Datadog | Ingest" },
    },
    {
      id: "n_archive",
      type: "strategy",
      position: { x: 640, y: 400 },
      data: { kind: "archive", label: "AWS S3 | Archive" },
    },
    {
      id: "n_flex",
      type: "strategy",
      position: { x: 80, y: 560 },
      data: {
        kind: "flex",
        label: "Flex Logs 30d (info)",
        flexRetentionDays: 30,
      },
    },
    {
      id: "n_index_warn",
      type: "strategy",
      position: { x: 280, y: 560 },
      data: {
        kind: "index",
        label: "7-Day Index (warn)",
        retentionDays: 7,
        tierLabel: "Standard",
      },
    },
    {
      id: "n_index_error",
      type: "strategy",
      position: { x: 480, y: 560 },
      data: {
        kind: "index",
        label: "30-Day Index (error)",
        retentionDays: 30,
        tierLabel: "Standard",
      },
    },
  ],
  edges: [
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
      data: { pct: 60 },
    },
    {
      id: "e_pipelines_archive",
      source: "n_pipelines",
      target: "n_archive",
      type: "pct",
      data: { pct: 40 },
    },
    {
      id: "e_ingest_flex",
      source: "n_ingest",
      target: "n_flex",
      type: "pct",
      data: { pct: 60 },
    },
    {
      id: "e_ingest_index_warn",
      source: "n_ingest",
      target: "n_index_warn",
      type: "pct",
      data: { pct: 30 },
    },
    {
      id: "e_ingest_index_error",
      source: "n_ingest",
      target: "n_index_error",
      type: "pct",
      data: { pct: 10 },
    },
  ],
};

const templates = [
  { filename: "flex-heavy-archive.xlsx", payload: flexHeavyArchive },
  {
    filename: "indexed-first-low-volume.xlsx",
    payload: indexedFirstLowVolume,
  },
  { filename: "tiered-ops-pipeline.xlsx", payload: tieredOpsPipeline },
];

async function writeTemplate(filename, payload) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Costs");
  ws.addRow([
    "Pre-built strategy template. Import into the Logging Strategy Visualizer to populate the cost sheet.",
  ]);
  const wsModel = wb.addWorksheet("_strategy_model");
  wsModel.getCell(1, 1).value = JSON.stringify(payload);
  const out = join(outDir, filename);
  await wb.xlsx.writeFile(out);
  console.log("wrote", out);
}

for (const t of templates) {
  await writeTemplate(t.filename, t.payload);
}
