import { useRef } from "react";
import { exportStrategyXlsx, importStrategyXlsx } from "@/lib/xlsxSync";
import { useStrategyStore } from "@/state/strategyStore";

export function Toolbar() {
  const fileRef = useRef<HTMLInputElement>(null);
  const newScenario = useStrategyStore((s) => s.newScenario);
  const resetPricingDefaults = useStrategyStore((s) => s.resetPricingDefaults);

  const exportFile = () => {
    exportStrategyXlsx(useStrategyStore.getState(), "logging-strategy.xlsx");
  };

  const onPickImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    await importStrategyXlsx(f, useStrategyStore.setState);
    e.target.value = "";
  };

  return (
    <header className="toolbar">
      <div className="toolbar__brand">
        <span className="toolbar__mark" aria-hidden="true">
          DD
        </span>
        <div className="toolbar__titles">
          <span className="toolbar__product">Datadog</span>
          <span className="toolbar__subtitle">Logging strategy visualizer</span>
        </div>
      </div>
      <div className="toolbar__actions">
        <button type="button" className="toolbar__btn toolbar__btn--ghost" onClick={newScenario}>
          New scenario
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
