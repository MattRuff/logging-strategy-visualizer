import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { datadogRum } from "@datadog/browser-rum";
import { handleCallback, signIn } from "@/auth/authClient";

export function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    handleCallback()
      .then(() => navigate("/visualizer", { replace: true }))
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error("auth callback failed", err);
        datadogRum.addError(err instanceof Error ? err : new Error(message), {
          flow: "auth_callback",
        });
        setError(message);
      });
  }, [navigate]);

  if (error) {
    const isUnconfirmed = /UserNotConfirmed|not confirmed|verify/i.test(error);

    return (
      <div style={{ padding: 24, maxWidth: 560, margin: "48px auto", fontFamily: "system-ui" }}>
        <h2 style={{ marginTop: 0 }}>We couldn't sign you in</h2>
        <p style={{ color: "#444" }}>
          {isUnconfirmed
            ? "Your account hasn't been verified yet. Check your inbox (and spam folder) for the verification code, or request a new one."
            : "Something went wrong while completing sign-in. You can try again, or request a new verification code if you just signed up."}
        </p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
          <button
            type="button"
            onClick={() => signIn()}
            style={primaryBtn}
          >
            Try sign-in again
          </button>
          <Link to="/auth/resend" style={secondaryBtn}>
            Resend verification code
          </Link>
          <Link to="/" style={secondaryBtn}>
            Back to home
          </Link>
        </div>

        <details style={{ marginTop: 24 }}>
          <summary style={{ cursor: "pointer", color: "#666" }}>Technical details</summary>
          <pre style={{ background: "#f4f4f4", padding: 12, overflow: "auto" }}>{error}</pre>
        </details>
      </div>
    );
  }
  return <div style={{ padding: 24 }}>Signing you in…</div>;
}

const primaryBtn: React.CSSProperties = {
  background: "#632ca6",
  color: "white",
  border: 0,
  padding: "8px 14px",
  borderRadius: 4,
  cursor: "pointer",
  textDecoration: "none",
  fontSize: 14,
};
const secondaryBtn: React.CSSProperties = {
  background: "white",
  color: "#632ca6",
  border: "1px solid #632ca6",
  padding: "8px 14px",
  borderRadius: 4,
  cursor: "pointer",
  textDecoration: "none",
  fontSize: 14,
};
