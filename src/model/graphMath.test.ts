import { describe, expect, it } from "vitest";
import { createInitialGraph } from "./initialGraph";
import {
  finiteNonNegative,
  orderedBfsFromSources,
  pathFractionToNode,
} from "./graphMath";

describe("pathFractionToNode", () => {
  it("accumulates edge percentages along the default graph", () => {
    const { nodes, edges } = createInitialGraph();
    const toIndex = pathFractionToNode(
      "n_source",
      "n_index",
      nodes,
      edges
    );
    expect(toIndex).not.toBeNull();
    expect(toIndex!.fraction).toBeCloseTo(0.4 * 0.2, 6);
  });
});

describe("finiteNonNegative", () => {
  it("falls back when value is undefined, NaN, or negative", () => {
    expect(finiteNonNegative(undefined, 10)).toBe(10);
    expect(finiteNonNegative(Number.NaN, 10)).toBe(10);
    expect(finiteNonNegative(-3, 10)).toBe(10);
    expect(finiteNonNegative(5, 10)).toBe(5);
  });
});

describe("orderedBfsFromSources", () => {
  it("visits sources before children in stable order", () => {
    const { nodes, edges } = createInitialGraph();
    const order = orderedBfsFromSources(nodes, edges);
    expect(order[0]).toBe("n_source");
    expect(order).toContain("n_ingest");
    expect(order.indexOf("n_ingest")).toBeLessThan(order.indexOf("n_index"));
  });
});
