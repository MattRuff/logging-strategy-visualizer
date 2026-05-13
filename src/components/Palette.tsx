import type { StrategyNodeData } from "@/model/types";
import { useStrategyStore } from "@/state/strategyStore";

type Item = {
  kind: StrategyNodeData["kind"];
  title: string;
  hint: string;
};

type Section = {
  id: string;
  title: string;
  /** CSS variable name (without `--`) or hex colour driving the section accent. */
  accent: string;
  items: Item[];
};

const SOURCE_ITEM: Item = {
  kind: "source",
  title: "Source",
  hint: "Volume entry (root of flow)",
};

const SECTIONS: Section[] = [
  {
    id: "pre-ingest",
    title: "Pre-ingest",
    accent: "#7c3aed",
    items: [
      {
        kind: "pipelines",
        title: "Obs. Pipelines",
        hint: "Observability Pipelines Plus (OP) pricing",
      },
      { kind: "siem", title: "SIEM", hint: "Pre-ingest SIEM (volume-tier $/GB)" },
      {
        kind: "third_party",
        title: "3rd Party",
        hint: "Customizable: GB or MM lines, custom $/unit",
      },
    ],
  },
  {
    id: "ingest-hot",
    title: "Ingest & Hot",
    accent: "#3399ff",
    items: [
      { kind: "ingest", title: "Ingest", hint: "Datadog ingest hop" },
      { kind: "index", title: "Index (hot)", hint: "Indexed / standard tier" },
    ],
  },
  {
    id: "retention",
    title: "Retention",
    accent: "#00b4a1",
    items: [
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
    ],
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

  const renderChip = (it: Item, accent: string) => (
    <button
      key={it.kind}
      type="button"
      className="palette__chip"
      draggable
      onDragStart={(e) => onDragStart(e, it.kind)}
      title={it.hint}
      style={
        {
          ["--chip-accent" as string]: accent,
        } as React.CSSProperties
      }
    >
      {it.title}
    </button>
  );

  return (
    <div className="palette">
      <div className="palette__section palette__section--source">
        {renderChip(SOURCE_ITEM, "var(--dd-purple)")}
      </div>
      {SECTIONS.map((section) => (
        <div key={section.id} className="palette__section">
          <div
            className="palette__section-title"
            style={
              {
                ["--section-accent" as string]: section.accent,
              } as React.CSSProperties
            }
          >
            {section.title}
          </div>
          <div className="palette__grid">
            {section.items.map((it) => renderChip(it, section.accent))}
          </div>
        </div>
      ))}
      <div className="palette__section">
        <div className="palette__section-title">Group</div>
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
    </div>
  );
}
