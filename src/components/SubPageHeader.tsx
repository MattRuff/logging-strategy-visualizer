import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";

export function SubPageHeader({ title }: { title: string }) {
  const { accessToken, email, signIn, signOut } = useAuth();
  return (
    <header className="toolbar">
      <div className="toolbar__brand">
        <Link to="/" className="toolbar__brand-link" title="Back to start">
          <span className="toolbar__mark" aria-hidden="true">DD</span>
          <div className="toolbar__titles">
            <span className="toolbar__product">Datadog · experimental</span>
            <span className="toolbar__subtitle">{title}</span>
          </div>
        </Link>
      </div>
      <div className="toolbar__actions">
        <Link to="/visualizer" className="toolbar__btn toolbar__btn--ghost">Visualizer</Link>
        <Link to="/workloads" className="toolbar__btn toolbar__btn--ghost">My scenarios</Link>
        <Link to="/archive" className="toolbar__btn toolbar__btn--ghost">Archive</Link>
        {accessToken ? (
          <>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</span>
            <button type="button" className="toolbar__btn toolbar__btn--secondary" onClick={() => signOut()}>Sign out</button>
          </>
        ) : (
          <button type="button" className="toolbar__btn toolbar__btn--primary" onClick={() => signIn()}>Sign in</button>
        )}
      </div>
    </header>
  );
}
