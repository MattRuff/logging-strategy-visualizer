import { FlowCanvas } from "@/components/flow/FlowCanvas";
import { InspectorPanel } from "@/components/InspectorPanel";
import { Palette } from "@/components/Palette";
import { Toolbar } from "@/components/Toolbar";
import { PricingVisibilityContext } from "@/state/PricingVisibilityContext";

export function VisualizerPage() {
  return (
    <PricingVisibilityContext.Provider value={false}>
      <div className="app">
        <Toolbar />
        <main className="app__main">
          <div className="app__flow">
            <FlowCanvas />
          </div>
          <aside className="app__aside">
            <Palette />
            <InspectorPanel />
          </aside>
        </main>
      </div>
    </PricingVisibilityContext.Provider>
  );
}
