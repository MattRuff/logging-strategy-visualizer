import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { useStrategyStore } from "@/state/strategyStore";
import { useAuth } from "@/auth/AuthProvider";
import { workloadApi, type WorkloadSummary } from "@/lib/workloadApi";

async function exportXlsx() {
  const { exportStrategyXlsx } = await import("@/lib/xlsxSync");
  await exportStrategyXlsx(useStrategyStore.getState(), "logging-strategy.xlsx");
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
}: ExpToolbarProps) {
  const { accessToken, email, signIn, signOut } = useAuth();
  const navigate = useNavigate();
  const newScenario = useStrategyStore((s) => s.newScenario);
  const undo = useStrategyStore((s) => s.undo);
  const canUndo = useStrategyStore((s) => s.past.length > 0);
  const layoutOrientation = useStrategyStore((s) => s.layoutOrientation);
  const setLayoutOrientation = useStrategyStore((s) => s.setLayoutOrientation);
  const resetPricingDefaults = useStrategyStore((s) => s.resetPricingDefaults);
  const fileRef = useRef<HTMLInputElement>(null);

  const [nameDraft, setNameDraft] = useState(workloadName);
  useEffect(() => setNameDraft(workloadName), [workloadName]);

  const [scenarios, setScenarios] = useState<WorkloadSummary[] | null>(null);
  const [scenariosError, setScenariosError] = useState<string | null>(null);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);

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
    navigate(`/visualizer?id=${encodeURIComponent(newId)}`);
    close();
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
      navigate(`/visualizer?id=${encodeURIComponent(newId)}`);
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
      setPublishMessage("Published to archive ✓");
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
            <span className="toolbar__product">Datadog · experimental</span>
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
                <MenuItem onClick={() => handleSaveAs(close)} disabled={!accessToken}>
                  Save as…
                </MenuItem>
                <MenuItem onClick={() => handlePublish(close)} disabled={!accessToken || readOnly}>
                  Publish to archive
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
                          navigate(`/visualizer?id=${encodeURIComponent(it.id)}`);
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
          {(close) => (
            <>
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
          )}
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
                  onClick={() => {
                    close();
                    navigate("/workloads");
                  }}
                >
                  My scenarios
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    close();
                    navigate("/archive");
                  }}
                >
                  Browse archive
                </MenuItem>
                <MenuDivider />
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
    </header>
  );
}
