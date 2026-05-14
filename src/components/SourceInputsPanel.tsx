import { GB_PER_TB } from "@/model/pricingCatalog";
import {
  DEFAULT_MILLION_LINES_PER_MONTH,
  DEFAULT_TOTAL_TB_PER_MONTH,
} from "@/model/volumeDefaults";
import { useStrategyStore } from "@/state/strategyStore";

/**
 * Top-of-page panel for editing source volumes. Pulled out of the right-side
 * inspector so EM/Sales can find the primary inputs without clicking a node first.
 */
export function SourceInputsPanel() {
  const nodes = useStrategyStore((s) => s.nodes);
  const updateNodeData = useStrategyStore((s) => s.updateNodeData);
  const resetToTemplate = useStrategyStore((s) => s.resetToTemplate);

  const sources = nodes.filter((n) => n.data?.kind === "source");

  return (
    <section className="source-inputs">
      <div className="source-inputs__header">
        <h2 className="source-inputs__title">Source inputs</h2>
        <button
          type="button"
          className="source-inputs__reset"
          onClick={resetToTemplate}
          title="Reset the canvas to the starting template"
        >
          Reset to template
        </button>
      </div>
      {sources.length === 0 ? (
        <p className="source-inputs__empty">No source nodes on the canvas.</p>
      ) : (
        <div className="source-inputs__grid">
          {sources.map((node) => {
            const tb = node.data.totalTbPerMonth ?? DEFAULT_TOTAL_TB_PER_MONTH;
            const gb = Math.round(tb * GB_PER_TB);
            const mLines =
              node.data.millionLinesPerMonth ?? DEFAULT_MILLION_LINES_PER_MONTH;
            return (
              <div key={node.id} className="source-inputs__row">
                <label className="source-inputs__field">
                  <span>{node.data.label}: Total ingest / month (GB)</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={gb}
                    onChange={(e) => {
                      const nextGb = Math.max(
                        0,
                        Math.round(Number(e.target.value))
                      );
                      const patch: Partial<typeof node.data> = {
                        totalTbPerMonth: nextGb / GB_PER_TB,
                      };
                      if (!node.data.millionLinesManuallySet) {
                        patch.millionLinesPerMonth = nextGb;
                      }
                      updateNodeData(node.id, patch);
                    }}
                  />
                </label>
                <label className="source-inputs__field">
                  <span>Total Logs stored / month (MM lines)</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={mLines}
                    onChange={(e) =>
                      updateNodeData(node.id, {
                        millionLinesPerMonth: Math.max(
                          0,
                          Math.round(Number(e.target.value))
                        ),
                        millionLinesManuallySet: true,
                      })
                    }
                  />
                </label>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
