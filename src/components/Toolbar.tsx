import { useRef } from "react";
import { Link } from "react-router-dom";
import { useStrategyStore } from "@/state/strategyStore";

export function Toolbar() {
  const fileRef = useRef<HTMLInputElement>(null);
  const newScenario = useStrategyStore((s) => s.newScenario);
  const resetPricingDefaults = useStrategyStore((s) => s.resetPricingDefaults);
  const undo = useStrategyStore((s) => s.undo);
  const canUndo = useStrategyStore((s) => s.past.length > 0);
  const pushHistory = useStrategyStore((s) => s.pushHistory);
  const layoutOrientation = useStrategyStore((s) => s.layoutOrientation);
  const setLayoutOrientation = useStrategyStore((s) => s.setLayoutOrientation);

  const exportFile = async () => {
    // Lazy-load the xlsx module so exceljs ships in its own chunk.
    const { exportStrategyXlsx } = await import("@/lib/xlsxSync");
    await exportStrategyXlsx(
      useStrategyStore.getState(),
      "logging-strategy.xlsx"
    );
  };

  const onPickImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    // Snapshot before import so undo can revert to the pre-import scenario.
    pushHistory();
    const { importStrategyXlsx } = await import("@/lib/xlsxSync");
    await importStrategyXlsx(f, useStrategyStore.setState);
    e.target.value = "";
  };

  return (
    <header className="toolbar">
      <div className="toolbar__brand">
        <Link to="/" className="toolbar__brand-link" title="Back to start">
          <span className="toolbar__mark" aria-hidden="true">
            DD
          </span>
          <div className="toolbar__titles">
            <span className="toolbar__product">Datadog</span>
            <span className="toolbar__subtitle">Logging strategy visualizer</span>
          </div>
        </Link>
      </div>
      <div className="toolbar__actions">
        <button
          type="button"
          className="toolbar__btn toolbar__btn--ghost"
          onClick={undo}
          disabled={!canUndo}
          title="Undo last change (⌘Z / Ctrl+Z)"
        >
          Undo
        </button>
        <button type="button" className="toolbar__btn toolbar__btn--ghost" onClick={newScenario}>
          New scenario
        </button>
        <button
          type="button"
          className="toolbar__btn toolbar__btn--ghost"
          onClick={() =>
            setLayoutOrientation(
              layoutOrientation === "horizontal" ? "vertical" : "horizontal"
            )
          }
          title={`Switch to ${layoutOrientation === "horizontal" ? "vertical" : "horizontal"} layout`}
        >
          {layoutOrientation === "horizontal" ? "↔ Horizontal" : "↕ Vertical"}
        </button>
        <button
          type="button"
          className="toolbar__btn toolbar__btn--ghost"
          onClick={resetPricingDefaults}
        >
          Reset pricing defaults
        </button>
        <button type="button" className="toolbar__btn toolbar__btn--primary" onClick={exportFile}>
          Export .xlsx
        </button>
        <button
          type="button"
          className="toolbar__btn toolbar__btn--secondary"
          onClick={() => fileRef.current?.click()}
        >
          Import .xlsx
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          hidden
          onChange={onPickImport}
        />
      </div>
    </header>
  );
}
