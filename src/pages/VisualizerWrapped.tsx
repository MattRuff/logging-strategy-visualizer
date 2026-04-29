import { VisualizerPage } from "@/pages/VisualizerPage";
import { PricingPage } from "@/pages/PricingPage";
import { HybridPage } from "@/pages/HybridPage";
import { WorkloadShell } from "@/pages/WorkloadShell";

export function VisualizerRoute() {
  return (
    <WorkloadShell>
      <VisualizerPage />
    </WorkloadShell>
  );
}

export function PricingRoute() {
  return (
    <WorkloadShell>
      <PricingPage />
    </WorkloadShell>
  );
}

export function HybridRoute() {
  return (
    <WorkloadShell>
      <HybridPage />
    </WorkloadShell>
  );
}
