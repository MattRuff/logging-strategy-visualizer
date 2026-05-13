import type { ReactFlowInstance } from "@xyflow/react";
import type { StrategyEdge, StrategyNode } from "@/model/types";

type Instance = ReactFlowInstance<StrategyNode, StrategyEdge>;

let current: Instance | null = null;

export function setFlowInstance(inst: Instance | null) {
  current = inst;
}

export function getFlowInstance(): Instance | null {
  return current;
}
