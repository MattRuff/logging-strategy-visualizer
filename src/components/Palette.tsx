import type { StrategyNodeData } from "@/model/types";

const items: { kind: StrategyNodeData["kind"]; title: string; hint: string }[] =
  [
    { kind: "source", title: "Source", hint: "Volume entry (root of flow)" },
    {
      kind: "pipelines",
      title: "Obs. Pipelines",
      hint: "Observability Pipelines Plus (OP) pricing",
    },
    { kind: "ingest", title: "Ingest", hint: "Datadog ingest hop" },
    { kind: "index", title: "Index (hot)", hint: "Indexed / standard tier" },
    { kind: "flex", title: "Flex", hint: "Flex storage" },
    { kind: "archive", title: "Archive", hint: "S3 / long-term" },
  ];

export function Palette() {
  const onDragStart = (
    e: React.DragEvent,
    kind: StrategyNodeData["kind"]
  ) => {
    e.dataTransfer.setData("application/strategy-node", kind);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="palette">
      <div className="palette__title">Add nodes</div>
      <div className="palette__grid">
        {items.map((it) => (
          <button
            key={it.kind}
            type="button"
            className="palette__chip"
            draggable
            onDragStart={(e) => onDragStart(e, it.kind)}
            title={it.hint}
          >
            {it.title}
          </button>
        ))}
      </div>
    </div>
  );
}
