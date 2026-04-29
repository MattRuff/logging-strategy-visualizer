import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { handleCallback } from "@/auth/authClient";

export function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    handleCallback()
      .then(() => navigate("/visualizer", { replace: true }))
      .catch((err) => {
        console.error("auth callback failed", err);
        setError(err instanceof Error ? err.message : String(err));
      });
  }, [navigate]);

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Sign-in failed</h2>
        <pre>{error}</pre>
      </div>
    );
  }
  return <div style={{ padding: 24 }}>Signing you in…</div>;
}
