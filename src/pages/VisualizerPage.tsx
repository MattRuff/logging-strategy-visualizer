import { FlowCanvas } from "@/components/flow/FlowCanvas";
import { InspectorPanel } from "@/components/InspectorPanel";
import { Palette } from "@/components/Palette";
import { PricingVisibilityContext } from "@/state/PricingVisibilityContext";

export function VisualizerPage() {
  return (
    <PricingVisibilityContext.Provider value={false}>
      <div className="app">
        <main className="app__main">
          <div className="app__flow">
            <FlowCanvas />
          </div>
          <aside className="app__aside">
            <div className="app__aside-hint">
              Drag any node onto the canvas to add it, then connect nodes
              by dragging from one handle to another.
            </div>
            <InspectorPanel />
            <div className="app__aside-scroll">
              <Palette />
            </div>
          </aside>
        </main>
      </div>
    </PricingVisibilityContext.Provider>
  );
}
