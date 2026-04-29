import { useEffect, useRef, useState } from "react";
import { useStrategyStore } from "@/state/strategyStore";
import { useAuth } from "@/auth/AuthProvider";
import { workloadApi } from "@/lib/workloadApi";

const AUTOSAVE_DEBOUNCE_MS = 1500;

interface AutoSaveOptions {
  workloadId: string;
  workloadName: string;
  /** When true (e.g. viewing an archived workload), autosave is disabled. */
  readOnly?: boolean;
  /** Trigger a save on mount even before the first edit (for renames, etc.). */
  saveOnMount?: boolean;
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Subscribes to the stable strategyStore and PUTs the serialized graph
 * to /api/workloads/:id ~1.5s after the user stops editing. No-op while
 * signed out or while the readOnly flag is true.
 */
export function useAutoSave({ workloadId, workloadName, readOnly, saveOnMount }: AutoSaveOptions): SaveStatus {
  const { accessToken } = useAuth();
  const [status, setStatus] = useState<SaveStatus>("idle");
  const lastSerializedRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!accessToken || readOnly) return;

    const doSave = async (payload: unknown) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setStatus("saving");
      try {
        await workloadApi.save(accessToken, workloadId, workloadName, payload);
        setStatus("saved");
      } catch (err) {
        console.error("autosave failed", err);
        setStatus("error");
      } finally {
        inFlightRef.current = false;
      }
    };

    const buildPayload = (state = useStrategyStore.getState()) => ({
      v: 3 as const,
      nodes: state.nodes,
      edges: state.edges,
      pricingOverrides: state.pricingOverrides,
      flexComputeTier: state.flexComputeTier,
      layoutOrientation: state.layoutOrientation,
    });

    if (saveOnMount) {
      const payload = buildPayload();
      lastSerializedRef.current = JSON.stringify(payload);
      void doSave(payload);
    }

    const unsub = useStrategyStore.subscribe((state) => {
      const payload = buildPayload(state);
      const serialized = JSON.stringify(payload);
      if (serialized === lastSerializedRef.current) return;
      lastSerializedRef.current = serialized;

      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        void doSave(payload);
      }, AUTOSAVE_DEBOUNCE_MS);
    });

    return () => {
      unsub();
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [accessToken, workloadId, workloadName, readOnly, saveOnMount]);

  return status;
}
