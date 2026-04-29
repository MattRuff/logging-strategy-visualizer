import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { CostSheet } from "@/components/CostSheet";
import { FlowCanvas } from "@/components/flow/FlowCanvas";
import { InspectorPanel } from "@/components/InspectorPanel";
import { Palette } from "@/components/Palette";
import { PricingVisibilityContext } from "@/state/PricingVisibilityContext";

export function HybridPage() {
  return (
    <PricingVisibilityContext.Provider value={true}>
      <div className="app">
        <PanelGroup direction="vertical" className="app__panels">
          <Panel defaultSize={58} minSize={35}>
            <main className="app__main">
              <div className="app__flow">
                <FlowCanvas />
              </div>
              <aside className="app__aside">
                <Palette />
                <InspectorPanel />
              </aside>
            </main>
          </Panel>
          <PanelResizeHandle className="app__resize-handle" />
          <Panel defaultSize={42} minSize={18}>
            <CostSheet />
          </Panel>
        </PanelGroup>
      </div>
    </PricingVisibilityContext.Provider>
  );
}
