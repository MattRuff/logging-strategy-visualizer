import { useEffect, type ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";

const ALLOWED_DOMAINS = ["datadoghq.com"];

function emailDomainAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  return ALLOWED_DOMAINS.includes(email.slice(at + 1).toLowerCase());
}

export function RequireDatadogUser({ children }: { children: ReactNode }) {
  const { user, loading, signIn, signOut } = useAuth();

  // When unauthenticated, kick off the Cognito redirect immediately. Cognito's
  // Hosted UI is the only entry point — there is no in-app sign-in form.
  useEffect(() => {
    if (!loading && !user) {
      void signIn();
    }
  }, [loading, user, signIn]);

  if (loading) return <CenteredMessage>Loading…</CenteredMessage>;
  if (!user) return <CenteredMessage>Redirecting to sign in…</CenteredMessage>;

  const profile = user.profile ?? {};
  const email = (profile.email as string | undefined) ?? null;
  const emailVerified = profile.email_verified === true;

  if (!emailVerified) {
    return <Navigate to="/auth/resend" replace />;
  }

  if (!emailDomainAllowed(email)) {
    return (
      <CenteredMessage>
        <h2 style={{ margin: "0 0 8px" }}>Not authorized</h2>
        <p style={{ margin: "0 0 16px", maxWidth: 420 }}>
          This app is only available to Datadog employees. The signed-in
          account <strong>{email ?? "(unknown email)"}</strong> isn't a Datadog
          address.
        </p>
        <button type="button" onClick={() => signOut()} style={btnStyle}>
          Sign out
        </button>
        <p style={{ marginTop: 24, fontSize: 12 }}>
          <Link to="/auth/resend">Trouble with verification?</Link>
        </p>
      </CenteredMessage>
    );
  }

  return <>{children}</>;
}

function CenteredMessage({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: 24,
        gap: 8,
        color: "var(--dd-text, #222)",
      }}
    >
      {children}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  border: "1px solid var(--dd-border-strong, #ccc)",
  background: "transparent",
};
