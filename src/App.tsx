import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthProvider";
import { AdminPage } from "@/pages/AdminPage";
import { AuthCallback } from "@/pages/AuthCallback";
import { Archive } from "@/pages/Archive";
import { Landing } from "@/pages/Landing";
import { MyWorkloads } from "@/pages/MyWorkloads";
import {
  HybridRoute,
  PricingRoute,
  VisualizerRoute,
} from "@/pages/VisualizerWrapped";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/visualizer" element={<VisualizerRoute />} />
        <Route path="/pricing" element={<PricingRoute />} />
        <Route path="/hybrid" element={<HybridRoute />} />
        <Route path="/workloads" element={<MyWorkloads />} />
        <Route path="/archive" element={<Archive />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
