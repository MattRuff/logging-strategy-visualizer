import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useStrategyStore } from "@/state/strategyStore";
import { useAuth } from "@/auth/AuthProvider";
import { workloadApi, type TemplateSummary, type WorkloadSummary } from "@/lib/workloadApi";
import { hydrateStoreFromPayload } from "@/lib/hydrateStore";

async function exportXlsx() {
  const { exportStrategyXlsx } = await import("@/lib/xlsxSync");
  await exportStrategyXlsx(useStrategyStore.getState(), "logging-strategy.xlsx");
}

async function exportPng() {
  const { exportFlowPng } = await import("@/lib/exportImage");
  await exportFlowPng();
}

async function exportPdf() {
  const { exportFlowPdf } = await import("@/lib/exportImage");
  await exportFlowPdf();
}

async function importXlsx(file: File) {
  const { pushHistory } = useStrategyStore.getState();
  pushHistory();
  const { importStrategyXlsx } = await import("@/lib/xlsxSync");
  await importStrategyXlsx(file, useStrategyStore.setState);
}

interface ExpToolbarProps {
  workloadId: string;
  workloadName: string;
  onWorkloadNameChange: (name: string) => void;
  readOnly: boolean;
  saveStatus: "idle" | "saving" | "saved" | "error";
  onSave: () => void;
}

function newWorkloadId(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 12);
}

interface MenuPopoverProps {
  trigger: ReactNode;
  triggerClassName?: string;
  /** Right-align the popover panel against the trigger button. */
  align?: "left" | "right";
  /** Disable the trigger when needed. */
  disabled?: boolean;
  /** Render-prop receives a close() function. */
  children: (close: () => void) => ReactNode;
}

function MenuPopover({
  trigger,
  triggerClassName = "toolbar__btn toolbar__btn--ghost",
  align = "right",
  disabled,
  children,
}: MenuPopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="menu-popover">
      <button
        type="button"
        className={triggerClassName}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        {trigger}
      </button>
      {open && (
        <div
          className={`menu-popover__panel menu-popover__panel--${align}`}
          role="menu"
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  onClick,
  disabled,
  children,
  shortcut,
  danger,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
  shortcut?: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`menu-popover__item ${danger ? "menu-popover__item--danger" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span>{children}</span>
      {shortcut ? <kbd className="menu-popover__shortcut">{shortcut}</kbd> : null}
    </button>
  );
}

function MenuDivider() {
  return <div className="menu-popover__divider" role="separator" />;
}

export function ExpToolbar({
  workloadId,
  workloadName,
  onWorkloadNameChange,
  readOnly,
  saveStatus,
  onSave,
}: ExpToolbarProps) {
  const { accessToken, email, signIn, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const newScenario = useStrategyStore((s) => s.newScenario);
  const undo = useStrategyStore((s) => s.undo);
  const canUndo = useStrategyStore((s) => s.past.length > 0);
  const layoutOrientation = useStrategyStore((s) => s.layoutOrientation);
  const setLayoutOrientation = useStrategyStore((s) => s.setLayoutOrientation);
  const resetPricingDefaults = useStrategyStore((s) => s.resetPricingDefaults);
  const currentTemplateId = useStrategyStore((s) => s.templateId);
  const setTemplateId = useStrategyStore((s) => s.setTemplateId);
  const fileRef = useRef<HTMLInputElement>(null);

  const [nameDraft, setNameDraft] = useState(workloadName);
  useEffect(() => setNameDraft(workloadName), [workloadName]);

  const [scenarios, setScenarios] = useState<WorkloadSummary[] | null>(null);
  const [scenariosError, setScenariosError] = useState<string | null>(null);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateSummary[] | null>(null);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  // Lazy-load scenario list when File menu first becomes useful.
  const loadScenarios = () => {
    if (!accessToken) return;
    setScenariosError(null);
    workloadApi
      .listMine(accessToken)
      .then((r) => setScenarios(r.workloads))
      .catch((err) => setScenariosError(err instanceof Error ? err.message : String(err)));
  };

  const handleNew = (close: () => void) => {
    const newId = newWorkloadId();
    newScenario();
    onWorkloadNameChange("Untitled scenario");
    navigate(`${location.pathname}?id=${encodeURIComponent(newId)}`);
    close();
  };

  const openTemplatePicker = (close: () => void) => {
    if (!accessToken) {
      signIn();
      return;
    }
    close();
    setTemplatesError(null);
    setTemplatePickerOpen(true);
    workloadApi
      .listTemplates(accessToken)
      .then((r) =>
        setTemplates(
          [...r.workloads].sort((a, b) => {
            const ao = a.isOfficial ? 1 : 0;
            const bo = b.isOfficial ? 1 : 0;
            if (ao !== bo) return bo - ao;
            return b.publishedAt.localeCompare(a.publishedAt);
          })
        )
      )
      .catch((err) =>
        setTemplatesError(err instanceof Error ? err.message : String(err))
      );
  };

  const handlePickTemplate = async (t: TemplateSummary) => {
    if (!accessToken) return;
    try {
      const detail = await workloadApi.load(accessToken, t.id);
      const newId = newWorkloadId();
      const basePayload = detail.payload as Parameters<typeof hydrateStoreFromPayload>[0];
      const payloadWithSource = { ...basePayload, templateId: t.id };
      hydrateStoreFromPayload(payloadWithSource);
      setTemplateId(t.id);
      const newName = `${t.name} (copy)`;
      await workloadApi.save(accessToken, newId, newName, payloadWithSource);
      onWorkloadNameChange(newName);
      navigate(`${location.pathname}?id=${encodeURIComponent(newId)}`);
      setTemplatePickerOpen(false);
    } catch (err) {
      setTemplatesError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleResetToTemplate = async (close: () => void) => {
    close();
    if (!accessToken || !currentTemplateId) return;
    if (!window.confirm("Reset this scenario back to its source template? Unsaved local edits will be lost.")) return;
    try {
      const detail = await workloadApi.load(accessToken, currentTemplateId);
      const basePayload = detail.payload as Parameters<typeof hydrateStoreFromPayload>[0];
      hydrateStoreFromPayload({ ...basePayload, templateId: currentTemplateId });
      setTemplateId(currentTemplateId);
    } catch (err) {
      window.alert(`Reset failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleSaveAs = async (close: () => void) => {
    if (!accessToken) {
      signIn();
      return;
    }
    const name = window.prompt("Save current scenario as:", workloadName);
    if (!name?.trim()) return;
    const newId = newWorkloadId();
    const state = useStrategyStore.getState();
    const payload = {
      v: 3 as const,
      nodes: state.nodes,
      edges: state.edges,
      pricingOverrides: state.pricingOverrides,
      flexComputeTier: state.flexComputeTier,
      layoutOrientation: state.layoutOrientation,
    };
    try {
      await workloadApi.save(accessToken, newId, name.trim(), payload);
      onWorkloadNameChange(name.trim());
      navigate(`${location.pathname}?id=${encodeURIComponent(newId)}`);
    } catch (err) {
      window.alert(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    close();
  };

  const handlePublish = async (close: () => void) => {
    if (!accessToken) {
      signIn();
      return;
    }
    setPublishMessage(null);
    try {
      await workloadApi.publish(accessToken, workloadId);
      setPublishMessage("Published as template ✓");
      window.setTimeout(() => setPublishMessage(null), 2500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setPublishMessage(`Publish failed: ${msg}`);
      window.setTimeout(() => setPublishMessage(null), 4000);
    }
    close();
  };

  const onNameBlur = () => {
    const next = nameDraft.trim() || "Untitled scenario";
    if (next !== workloadName) onWorkloadNameChange(next);
  };

  return (
    <header className="toolbar">
      <div className="toolbar__brand">
        <Link to="/" className="toolbar__brand-link" title="Back to start">
          <span className="toolbar__mark" aria-hidden="true">DD</span>
          <div className="toolbar__titles">
            <span className="toolbar__product">Datadog · prod</span>
            <span className="toolbar__subtitle">Logging strategy visualizer</span>
          </div>
        </Link>
      </div>

      <div className="toolbar__inputs">
        <label>
          Scenario
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={onNameBlur}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            placeholder="Untitled scenario"
            disabled={readOnly}
            style={{ width: 200 }}
          />
        </label>
        <span className="toolbar__save-status">
          {readOnly
            ? "Read-only"
            : publishMessage
            ? publishMessage
            : saveStatus === "saving"
            ? "Saving…"
            : saveStatus === "saved"
            ? "Saved ✓"
            : saveStatus === "error"
            ? "Save failed"
            : ""}
        </span>
      </div>

      <div className="toolbar__actions">
        {/* File menu */}
        <MenuPopover
          trigger={<>File ▾</>}
          align="right"
        >
          {(close) => {
            // Trigger lazy load once the menu opens.
            if (!scenarios && !scenariosError && accessToken) loadScenarios();
            return (
              <>
                <MenuItem onClick={() => handleNew(close)} disabled={!accessToken}>
                  New scenario
                </MenuItem>
                <MenuItem onClick={() => openTemplatePicker(close)} disabled={!accessToken}>
                  New scenario from template…
                </MenuItem>
                <MenuItem
                  onClick={() => handleResetToTemplate(close)}
                  disabled={!accessToken || readOnly || !currentTemplateId}
                >
                  Reset to template
                </MenuItem>
                <MenuItem
                  onClick={() => { onSave(); close(); }}
                  disabled={!accessToken || readOnly}
                  shortcut="⌘S"
                >
                  Save
                </MenuItem>
                <MenuItem onClick={() => handleSaveAs(close)} disabled={!accessToken}>
                  Save as…
                </MenuItem>
                <MenuItem onClick={() => handlePublish(close)} disabled={!accessToken || readOnly}>
                  Publish as template
                </MenuItem>
                <MenuDivider />
                <MenuItem
                  onClick={() => {
                    close();
                    navigate("/workloads");
                  }}
                  disabled={!accessToken}
                >
                  My scenarios
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    close();
                    navigate("/templates");
                  }}
                >
                  Browse templates
                </MenuItem>
                <MenuDivider />
                <MenuItem
                  onClick={() => {
                    fileRef.current?.click();
                    close();
                  }}
                >
                  Import .xlsx
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    void exportXlsx();
                    close();
                  }}
                >
                  Export .xlsx
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    void exportPng();
                    close();
                  }}
                >
                  Export .png
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    void exportPdf();
                    close();
                  }}
                >
                  Export .pdf
                </MenuItem>
                <MenuDivider />
                <div className="menu-popover__section-title">Open scenario</div>
                {!accessToken && (
                  <div className="menu-popover__hint">Sign in to see your saved scenarios.</div>
                )}
                {scenariosError && (
                  <div className="menu-popover__hint menu-popover__hint--error">
                    {scenariosError}
                  </div>
                )}
                {accessToken && !scenarios && !scenariosError && (
                  <div className="menu-popover__hint">Loading…</div>
                )}
                {scenarios && scenarios.length === 0 && (
                  <div className="menu-popover__hint">No saved scenarios yet.</div>
                )}
                {scenarios && scenarios.length > 0 && (
                  <div className="menu-popover__list">
                    {scenarios.map((it) => (
                      <button
                        type="button"
                        key={it.id}
                        role="menuitem"
                        className={`menu-popover__list-item ${
                          it.id === workloadId ? "menu-popover__list-item--current" : ""
                        }`}
                        onClick={() => {
                          close();
                          navigate(`${location.pathname}?id=${encodeURIComponent(it.id)}`);
                        }}
                      >
                        <span className="menu-popover__list-item-name">{it.name}</span>
                        <span className="menu-popover__list-item-meta">
                          {new Date(it.updatedAt).toLocaleString()}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            );
          }}
        </MenuPopover>

        {/* View menu */}
        <MenuPopover trigger={<>View ▾</>} align="right">
          {(close) => {
            const currentId = searchParams.get("id");
            const idParam = currentId ? `?id=${encodeURIComponent(currentId)}` : "";
            const currentPath = location.pathname;
            const navigateTo = (path: string) => {
              navigate(path + idParam);
              close();
            };
            return (
              <>
                <div className="menu-popover__section-title">Switch view</div>
                <MenuItem
                  onClick={() => navigateTo("/visualizer")}
                  disabled={currentPath === "/visualizer"}
                >
                  Visualizer
                </MenuItem>
                <MenuItem
                  onClick={() => navigateTo("/hybrid")}
                  disabled={currentPath === "/hybrid"}
                >
                  Hybrid
                </MenuItem>
                <MenuItem
                  onClick={() => navigateTo("/pricing")}
                  disabled={currentPath === "/pricing"}
                >
                  Pricing
                </MenuItem>
                <MenuDivider />
                <MenuItem
                  onClick={() => {
                    undo();
                    close();
                  }}
                  disabled={!canUndo}
                  shortcut="⌘Z"
                >
                  Undo
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setLayoutOrientation(
                      layoutOrientation === "horizontal" ? "vertical" : "horizontal"
                    );
                    close();
                  }}
                >
                  {layoutOrientation === "horizontal"
                    ? "Switch to vertical layout"
                    : "Switch to horizontal layout"}
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    resetPricingDefaults();
                    close();
                  }}
                >
                  Reset pricing defaults
                </MenuItem>
              </>
            );
          }}
        </MenuPopover>

        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importXlsx(f);
            e.target.value = "";
          }}
        />

        {accessToken ? (
          <MenuPopover
            trigger={
              <span className="toolbar__avatar" aria-label="Account menu">
                {(email ?? "?").slice(0, 1).toUpperCase()}
              </span>
            }
            triggerClassName="toolbar__avatar-btn"
            align="right"
          >
            {(close) => (
              <>
                <div className="menu-popover__header" title={email ?? ""}>
                  Signed in as
                  <div className="menu-popover__header-email">{email}</div>
                </div>
                <MenuItem
                  danger
                  onClick={() => {
                    close();
                    signOut();
                  }}
                >
                  Sign out
                </MenuItem>
              </>
            )}
          </MenuPopover>
        ) : (
          <button
            type="button"
            className="toolbar__btn toolbar__btn--primary"
            onClick={() => signIn()}
          >
            Sign in
          </button>
        )}
      </div>

      {templatePickerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Pick a template"
          onClick={() => setTemplatePickerOpen(false)}
          style={modalBackdrop}
        >
          <div onClick={(e) => e.stopPropagation()} style={modalCard}>
            <div style={modalHeader}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Pick a template</h3>
              <button
                type="button"
                onClick={() => setTemplatePickerOpen(false)}
                style={modalCloseBtn}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--dd-text-muted)" }}>
              Starts a new scenario in your account from the selected template.
              Official templates from admins are pinned to the top.
            </p>
            {templatesError && (
              <div style={{ color: "crimson", fontSize: 13, marginBottom: 8 }}>{templatesError}</div>
            )}
            {!templates && !templatesError && (
              <div style={{ fontSize: 13, color: "var(--dd-text-muted)" }}>Loading…</div>
            )}
            {templates && templates.length === 0 && (
              <div style={{ fontSize: 13, color: "var(--dd-text-muted)" }}>No templates published yet.</div>
            )}
            {templates && templates.length > 0 && (
              <div style={{ maxHeight: 360, overflowY: "auto", border: "1px solid var(--dd-border)", borderRadius: "var(--dd-radius)" }}>
                {templates.map((t) => (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => void handlePickTemplate(t)}
                    style={templateRow}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 600, color: "var(--dd-text)" }}>{t.name}</span>
                      {t.isOfficial && <span style={officialBadge}>Official</span>}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--dd-text-muted)" }}>
                      {t.ownerEmail ?? "—"} · {new Date(t.publishedAt).toLocaleDateString()}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

const modalBackdrop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15,17,21,0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};
const modalCard: React.CSSProperties = {
  background: "var(--dd-surface)",
  borderRadius: "var(--dd-radius-lg)",
  padding: 20,
  width: "min(520px, 92vw)",
  boxShadow: "var(--dd-shadow)",
  border: "1px solid var(--dd-border)",
};
const modalHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 8,
};
const modalCloseBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  fontSize: 16,
  cursor: "pointer",
  color: "var(--dd-text-muted)",
};
const templateRow: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  width: "100%",
  textAlign: "left",
  padding: "10px 12px",
  background: "transparent",
  border: "none",
  borderBottom: "1px solid var(--dd-border)",
  cursor: "pointer",
  gap: 2,
};
const officialBadge: React.CSSProperties = {
  display: "inline-block",
  padding: "1px 6px",
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  background: "var(--dd-purple)",
  color: "#fff",
  borderRadius: 999,
};
