import type { StrategyNodeData } from "@/model/types";
import { useStrategyStore } from "@/state/strategyStore";

const items: { kind: StrategyNodeData["kind"]; title: string; hint: string }[] =
  [
    { kind: "source", title: "Source", hint: "Volume entry (root of flow)" },
    {
      kind: "pipelines",
      title: "Obs. Pipelines",
      hint: "Observability Pipelines Plus (OP) pricing",
    },
    {
      kind: "siem",
      title: "SIEM",
      hint: "Pre-ingest SIEM (volume-tier $/GB)",
    },
    { kind: "ingest", title: "Ingest", hint: "Datadog ingest hop" },
    { kind: "index", title: "Index (hot)", hint: "Indexed / standard tier" },
    { kind: "flex", title: "Flex", hint: "Flex storage" },
    {
      kind: "flex_starter",
      title: "Flex Starter",
      hint: "Flex Logs Starter — pay-per-event, no compute",
    },
    { kind: "archive", title: "Archive", hint: "S3 / long-term" },
    {
      kind: "archive_search",
      title: "Archive Search",
      hint: "Searches against archived data ($/GB scanned)",
    },
  ];

export function Palette() {
  const groupMode = useStrategyStore((s) => s.groupDrawMode);
  const setGroupMode = useStrategyStore((s) => s.setGroupDrawMode);

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
      <div className="palette__title palette__title--secondary">Group</div>
      <button
        type="button"
        className={`palette__chip palette__chip--group ${
          groupMode ? "palette__chip--active" : ""
        }`}
        onClick={() => setGroupMode(!groupMode)}
        title={
          groupMode
            ? "Click to cancel (Esc) — or drag a rectangle on the canvas to enclose nodes."
            : "Click, then drag a rectangle on the canvas to group whatever it encloses."
        }
      >
        {groupMode ? "Drawing… (Esc to cancel)" : "+ New group"}
      </button>
    </div>
  );
}
