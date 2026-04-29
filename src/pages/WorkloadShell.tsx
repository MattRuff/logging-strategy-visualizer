import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { ExpToolbar } from "@/components/ExpToolbar";
import { useAuth } from "@/auth/AuthProvider";
import { useAutoSave } from "@/state/useAutoSave";
import { workloadApi, type WorkloadDetail, ApiError } from "@/lib/workloadApi";
import { hydrateStoreFromPayload } from "@/lib/hydrateStore";

const DEFAULT_WORKLOAD_ID = "default";
const DEFAULT_WORKLOAD_NAME = "Untitled scenario";

/**
 * Wraps a scenario page (Visualizer / Pricing / Hybrid) with:
 *  - the toolbar (auth + scenario controls)
 *  - one-time hydration from the saved workload identified by ?id=
 *  - debounced autosave back to /api/workloads/:id
 */
export function WorkloadShell({ children }: { children: ReactNode }) {
  const [params] = useSearchParams();
  const id = params.get("id") ?? DEFAULT_WORKLOAD_ID;
  const archive = params.get("archive") === "1";

  const { accessToken } = useAuth();
  const [name, setName] = useState(DEFAULT_WORKLOAD_NAME);
  const [readOnly, setReadOnly] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingNameSave, setPendingNameSave] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      setReadOnly(false);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    setLoadError(null);
    workloadApi
      .load(accessToken, id)
      .then((detail: WorkloadDetail) => {
        if (cancelled) return;
        hydrateStoreFromPayload(
          detail.payload as Parameters<typeof hydrateStoreFromPayload>[0]
        );
        setName(detail.name);
        setReadOnly(detail.readOnly || archive);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setName(DEFAULT_WORKLOAD_NAME);
          setReadOnly(archive);
        } else {
          setLoadError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => { cancelled = true; };
  }, [accessToken, id, archive]);

  const status = useAutoSave({
    workloadId: id,
    workloadName: name,
    readOnly,
    saveOnMount: pendingNameSave,
  });

  useEffect(() => {
    if (pendingNameSave && (status === "saved" || status === "error")) {
      setPendingNameSave(false);
    }
  }, [status, pendingNameSave]);

  const handleNameChange = (next: string) => {
    setName(next);
    setPendingNameSave(true);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <ExpToolbar
        workloadId={id}
        workloadName={name}
        onWorkloadNameChange={handleNameChange}
        readOnly={readOnly}
        saveStatus={status}
      />
      {loadError && (
        <div
          style={{
            padding: "8px 16px",
            background: "#fdecea",
            color: "#8a2222",
            fontSize: 13,
            borderBottom: "1px solid #f4c0bc",
          }}
        >
          Failed to load workload: {loadError}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
        {children}
      </div>
    </div>
  );
}
