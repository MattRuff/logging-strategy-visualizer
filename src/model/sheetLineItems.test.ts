import { describe, expect, it } from "vitest";
import { createInitialGraph } from "./initialGraph";
import { buildSheetLineItems } from "./sheetLineItems";

describe("buildSheetLineItems", () => {
  it("includes pipelines (OP) and ingest before index on default graph", () => {
    const { nodes, edges } = createInitialGraph();
    const rows = buildSheetLineItems({
      nodes,
      edges,
      pricingOverrides: {},
      flexComputeTier: "sm",
    });
    const idxOp = rows.findIndex(
      (r) => r.skuKey === "observability_pipelines_plus"
    );
    const idxIngest = rows.findIndex((r) => r.skuKey === "log_ingestion");
    const idxStd = rows.findIndex((r) => r.skuKey?.startsWith("standard_"));
    expect(idxOp).toBeGreaterThanOrEqual(0);
    expect(idxIngest).toBeGreaterThan(idxOp);
    expect(idxStd).toBeGreaterThan(idxIngest);
  });

  it("never emits NaN monthly when source volume fields are missing", () => {
    const { nodes, edges } = createInitialGraph();
    const stripped = nodes.map((n) =>
      n.data.kind === "source"
        ? {
            ...n,
            data: {
              ...n.data,
              totalTbPerMonth: undefined,
              millionLinesPerMonth: undefined,
            },
          }
        : n
    );
    const rows = buildSheetLineItems({
      nodes: stripped,
      edges,
      pricingOverrides: {},
      flexComputeTier: "sm",
    });
    const bad = rows.filter((r) => r.monthly != null && Number.isNaN(r.monthly));
    expect(bad).toHaveLength(0);
  });

  it("adds flex aggregate and compute when flex nodes exist", () => {
    const { nodes, edges } = createInitialGraph();
    const rows = buildSheetLineItems({
      nodes,
      edges,
      pricingOverrides: {},
      flexComputeTier: "xs",
    });
    expect(rows.some((r) => r.lineKind === "flex_aggregate")).toBe(true);
    expect(rows.some((r) => r.lineKind === "flex_compute")).toBe(true);
    expect(rows.some((r) => r.skuKey === "flex_node_row")).toBe(false);
    const flexStorage = rows.find((r) => r.lineKind === "flex_aggregate");
    expect(flexStorage?.displayType).toBe("Flex Storage");
    expect(flexStorage?.description).toMatch(/Flex Tier Storage/);
  });
});
