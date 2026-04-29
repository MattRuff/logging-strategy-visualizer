import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AdminPage } from "@/pages/AdminPage";
import { HybridPage } from "@/pages/HybridPage";
import { Landing } from "@/pages/Landing";
import { PricingPage } from "@/pages/PricingPage";
import { VisualizerPage } from "@/pages/VisualizerPage";
import { useStrategyStore } from "@/state/strategyStore";

function UndoShortcut() {
  const undo = useStrategyStore((s) => s.undo);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.shiftKey) return;
      if (e.key === "z" || e.key === "Z") {
        const tag = (e.target as HTMLElement | null)?.tagName;
        // Let native undo work inside inputs / textareas / contenteditable
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          (e.target as HTMLElement | null)?.isContentEditable
        ) {
          return;
        }
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo]);
  return null;
}

export default function App() {
  return (
    <>
      <UndoShortcut />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/visualizer" element={<VisualizerPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/hybrid" element={<HybridPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
