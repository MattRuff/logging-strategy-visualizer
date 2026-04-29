import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { workloadApi, type WorkloadSummary } from "@/lib/workloadApi";
import { SubPageHeader } from "@/components/SubPageHeader";

export function MyWorkloads() {
  const { accessToken, signIn } = useAuth();
  const [items, setItems] = useState<WorkloadSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    workloadApi
      .listMine(accessToken)
      .then((r) => setItems(r.workloads))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [accessToken]);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <SubPageHeader title="My scenarios" />
      <main style={{ padding: "24px 32px", maxWidth: 960, width: "100%", margin: "0 auto" }}>
        {!accessToken ? (
          <section className="dd-card" style={cardStyle}>
            <h2 style={h2Style}>Sign in to see your scenarios</h2>
            <p style={mutedText}>Your saved scenarios are private to your account.</p>
            <button
              type="button"
              className="toolbar__btn toolbar__btn--primary"
              style={{ background: "var(--dd-purple)", color: "#fff", marginTop: 8 }}
              onClick={() => signIn()}
            >
              Sign in
            </button>
          </section>
        ) : (
          <>
            <h2 style={h2Style}>My scenarios</h2>
            {error && <p style={errStyle}>{error}</p>}
            {!items && <p style={mutedText}>Loading…</p>}
            {items && items.length === 0 && (
              <p style={mutedText}>
                No saved scenarios yet. Open the <Link style={linkStyle} to="/visualizer">visualizer</Link> and start
                editing — autosave kicks in 1.5s after each change.
              </p>
            )}
            {items && items.length > 0 && (
              <div style={{ background: "var(--dd-surface)", borderRadius: "var(--dd-radius-lg)", boxShadow: "var(--dd-shadow)", overflow: "hidden", border: "1px solid var(--dd-border)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "var(--dd-bg-subtle)" }}>
                      <th style={th}>Name</th>
                      <th style={th}>Last updated</th>
                      <th style={{ ...th, textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.id} style={{ borderTop: "1px solid var(--dd-border)" }}>
                        <td style={td}>
                          <Link to={`/visualizer?id=${encodeURIComponent(it.id)}`} style={linkStyle}>
                            {it.name}
                          </Link>
                        </td>
                        <td style={{ ...td, color: "var(--dd-text-muted)" }}>{new Date(it.updatedAt).toLocaleString()}</td>
                        <td style={{ ...td, textAlign: "right" }}>
                          <button
                            type="button"
                            className="toolbar__btn toolbar__btn--ghost"
                            style={ghostBtnDark}
                            disabled={publishingId === it.id}
                            onClick={async () => {
                              setPublishingId(it.id);
                              try {
                                await workloadApi.publish(accessToken, it.id);
                              } catch (err) {
                                setError(err instanceof Error ? err.message : String(err));
                              } finally {
                                setPublishingId(null);
                              }
                            }}
                          >
                            {publishingId === it.id ? "Publishing…" : "Publish to archive"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "var(--dd-surface)",
  border: "1px solid var(--dd-border)",
  borderRadius: "var(--dd-radius-lg)",
  padding: 24,
  boxShadow: "var(--dd-shadow)",
};
const h2Style: React.CSSProperties = { margin: "0 0 16px", fontSize: 22, fontWeight: 700, color: "var(--dd-text)" };
const mutedText: React.CSSProperties = { color: "var(--dd-text-muted)", fontSize: 14 };
const errStyle: React.CSSProperties = { color: "crimson", fontSize: 13 };
const linkStyle: React.CSSProperties = { color: "var(--dd-purple)", textDecoration: "none", fontWeight: 600 };
const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 14px",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--dd-text-muted)",
  fontWeight: 700,
};
const td: React.CSSProperties = { padding: "10px 14px" };
const ghostBtnDark: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--dd-border-strong)",
  color: "var(--dd-text)",
};
