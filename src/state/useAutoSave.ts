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

export interface AutoSaveResult {
  status: SaveStatus;
  saveNow: () => void;
}

const buildPayload = (state = useStrategyStore.getState()) => ({
  v: 3 as const,
  nodes: state.nodes,
  edges: state.edges,
  pricingOverrides: state.pricingOverrides,
  flexComputeTier: state.flexComputeTier,
  layoutOrientation: state.layoutOrientation,
  templateId: state.templateId,
});

/**
 * Subscribes to the stable strategyStore and PUTs the serialized graph
 * to /api/workloads/:id ~1.5s after the user stops editing. No-op while
 * signed out or while the readOnly flag is true.
 *
 * Returns { status, saveNow } — saveNow() flushes immediately.
 */
export function useAutoSave({ workloadId, workloadName, readOnly, saveOnMount }: AutoSaveOptions): AutoSaveResult {
  const { accessToken } = useAuth();
  const [status, setStatus] = useState<SaveStatus>("idle");
  const lastSerializedRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);

  // Keep a stable ref to the latest accessToken/workloadId/workloadName so
  // saveNow() can use them without being re-created on every render.
  const ctxRef = useRef({ accessToken, workloadId, workloadName });
  useEffect(() => { ctxRef.current = { accessToken, workloadId, workloadName }; });

  const doSave = useRef(async (payload: unknown) => {
    const { accessToken: tok, workloadId: wid, workloadName: wname } = ctxRef.current;
    if (!tok || inFlightRef.current) return;
    inFlightRef.current = true;
    setStatus("saving");
    try {
      await workloadApi.save(tok, wid, wname, payload);
      setStatus("saved");
    } catch (err) {
      console.error("autosave failed", err);
      setStatus("error");
    } finally {
      inFlightRef.current = false;
    }
  }).current;

  const saveNow = useRef(() => {
    if (!ctxRef.current.accessToken || readOnly) return;
    if (timerRef.current !== null) { window.clearTimeout(timerRef.current); timerRef.current = null; }
    void doSave(buildPayload());
  }).current;

  useEffect(() => {
    if (!accessToken || readOnly) return;

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
  }, [accessToken, workloadId, workloadName, readOnly, saveOnMount, doSave]);

  return { status, saveNow };
}
