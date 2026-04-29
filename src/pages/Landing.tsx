import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useStrategyStore } from "@/state/strategyStore";
import {
  STRATEGY_TEMPLATES,
  type StrategyTemplate,
} from "@/templates/manifest";
import { useAuth } from "@/auth/AuthProvider";

const modes: {
  to: string;
  title: string;
  subtitle: string;
  description: string;
}[] = [
  {
    to: "/visualizer",
    title: "Customer facing",
    subtitle: "Visualization only",
    description:
      "Explore the log routing flow on a canvas. Drag node types, connect them, and tune % splits without showing any pricing details.",
  },
  {
    to: "/pricing",
    title: "Pricing",
    subtitle: "Spreadsheet only",
    description:
      "Work straight from the cost sheet. Tune % of total, unit prices, retention, and see monthly / annual totals without the canvas.",
  },
  {
    to: "/hybrid",
    title: "Hybrid",
    subtitle: "Visualization + pricing",
    description:
      "Full workspace: canvas on top, cost sheet below. Changes sync both ways.",
  },
  {
    to: "/workloads",
    title: "My scenarios",
    subtitle: "Personal · auto-saved",
    description:
      "Open, rename, or publish any of your saved scenarios. Sign in to start auto-saving as you edit.",
  },
  {
    to: "/archive",
    title: "Browse archive",
    subtitle: "Read-only · published by anyone",
    description:
      "Open scenarios published by your teammates. View them read-only, or use “Save as…” to fork into your own list.",
  },
];

export function Landing() {
  const navigate = useNavigate();
  const { accessToken, email, signIn, signOut } = useAuth();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyTemplate = async (t: StrategyTemplate) => {
    setError(null);
    setLoadingId(t.id);
    try {
      useStrategyStore.getState().pushHistory();
      const res = await fetch(t.file);
      if (!res.ok) {
        throw new Error(
          `Could not download template (${res.status} ${res.statusText}).`
        );
      }
      const buf = await res.arrayBuffer();
      const { importStrategyXlsxFromBuffer } = await import("@/lib/xlsxSync");
      await importStrategyXlsxFromBuffer(buf, useStrategyStore.setState);
      const conflicts = useStrategyStore.getState().sheetConflicts;
      if (conflicts.length > 0) {
        setError(conflicts[0]);
        return;
      }
      navigate("/hybrid");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load template.");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="landing">
      <header className="landing__header">
        <div className="landing__brand">
          <span className="landing__mark" aria-hidden="true">DD</span>
          <div>
            <div className="landing__eyebrow">Datadog · experimental</div>
            <h1 className="landing__title">Logging strategy visualizer</h1>
          </div>
          <div style={authChipWrap}>
            {accessToken ? (
              <>
                <span style={emailStyle} title={email ?? ""}>{email}</span>
                <button type="button" style={ghostBtn} onClick={() => signOut()}>
                  Sign out
                </button>
              </>
            ) : (
              <button type="button" style={primaryBtn} onClick={() => signIn()}>
                Sign in
              </button>
            )}
          </div>
        </div>
        <p className="landing__lede">
          A sandbox for designing a Datadog logging setup end to end. Model
          where your logs come from, how they flow through Observability
          Pipelines and ingest, and which portion lands in Flex, Indexed, or
          Archive — then see the monthly and annual cost of that shape, all in
          one place.
        </p>

        <section className="landing__about">
          <div className="landing__about-col">
            <h3 className="landing__about-heading">What it is</h3>
            <p className="landing__about-text">
              An interactive graph + cost sheet. Drop source, pipeline, ingest,
              and destination nodes on a canvas, connect them, and set the
              percentage of logs routed along each edge. Every change
              recalculates the spreadsheet below (volumes, SKUs, monthly and
              annual spend).
            </p>
          </div>
          <div className="landing__about-col">
            <h3 className="landing__about-heading">Why use it</h3>
            <ul className="landing__about-list">
              <li>
                Compare routing strategies (Flex vs Indexed vs Archive splits)
                without spinning up a real environment.
              </li>
              <li>
                Talk through pricing with customers using either the visual
                flow, the cost sheet, or both side by side.
              </li>
              <li>
                Override unit prices and retention to match a specific quote
                and export the result as an .xlsx.
              </li>
            </ul>
          </div>
          <div className="landing__about-col">
            <h3 className="landing__about-heading">How to use it</h3>
            <ol className="landing__about-list landing__about-list--ordered">
              <li>Pick a mode below — you can switch any time.</li>
              <li>
                Drag node types from the palette, connect handles, and edit the
                % on each edge (the log count under it syncs automatically).
              </li>
              <li>
                Sign in and your edits auto-save under a named scenario; come
                back later, or publish to the archive for the team.
              </li>
            </ol>
          </div>
        </section>

        <p className="landing__lede landing__lede--sub">
          Choose how you want to work. You can switch at any time; your
          scenario auto-saves to your account once you sign in.
        </p>
      </header>

      <div className="landing__grid">
        {modes.map((m) => (
          <Link key={m.to} to={m.to} className="landing__card">
            <span className="landing__card-subtitle">{m.subtitle}</span>
            <h2 className="landing__card-title">{m.title}</h2>
            <p className="landing__card-desc">{m.description}</p>
            <span className="landing__card-cta">Open {m.title} →</span>
          </Link>
        ))}
      </div>

      <section className="landing__templates">
        <h2 className="landing__section-title">Start from a template</h2>
        <p className="landing__section-sub">
          Pre-built best-practice strategies. Pick one to seed the canvas and
          cost sheet, then tune from there. Undo reverts to your previous
          scenario.
        </p>
        {error && (
          <p className="landing__templates-error" role="alert">
            {error}
          </p>
        )}
        <div className="landing__grid landing__grid--templates">
          {STRATEGY_TEMPLATES.map((t) => {
            const busy = loadingId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                className="landing__card landing__card--template"
                onClick={() => applyTemplate(t)}
                disabled={loadingId !== null}
              >
                <span className="landing__card-subtitle">{t.subtitle}</span>
                <h3 className="landing__card-title">{t.title}</h3>
                <p className="landing__card-desc">{t.description}</p>
                <span className="landing__card-cta">
                  {busy ? "Loading…" : "Use this template →"}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <footer className="landing__footer">
        <Link to="/admin" className="landing__settings">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Settings — pricing & how it works
        </Link>
      </footer>
    </div>
  );
}

const authChipWrap: React.CSSProperties = {
  marginLeft: "auto",
  display: "flex",
  alignItems: "center",
  gap: 12,
};
const emailStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--dd-text-muted)",
  maxWidth: 220,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const baseBtn: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: "var(--dd-radius)",
  font: "inherit",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  border: "1px solid transparent",
  transition: "background 0.12s ease, border-color 0.12s ease, color 0.12s ease",
};
const ghostBtn: React.CSSProperties = {
  ...baseBtn,
  background: "transparent",
  borderColor: "var(--dd-border-strong)",
  color: "var(--dd-text)",
};
const primaryBtn: React.CSSProperties = {
  ...baseBtn,
  background: "var(--dd-purple)",
  borderColor: "var(--dd-purple)",
  color: "#fff",
};
