import { CostSheet } from "@/components/CostSheet";
import { Toolbar } from "@/components/Toolbar";

export function PricingPage() {
  return (
    <div className="app">
      <Toolbar />
      <main className="app__pricing-main">
        <CostSheet />
      </main>
    </div>
  );
}
