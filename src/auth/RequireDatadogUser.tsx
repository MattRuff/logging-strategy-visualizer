import { useEffect, useState, type ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { workloadApi } from "@/lib/workloadApi";
import {
  isPricingCatalogLoaded,
  setPricingCatalog,
} from "@/model/pricingCatalog";
import { useStrategyStore } from "@/state/strategyStore";

const ALLOWED_DOMAINS = ["datadoghq.com"];

function emailDomainAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  return ALLOWED_DOMAINS.includes(email.slice(at + 1).toLowerCase());
}

export function RequireDatadogUser({ children }: { children: ReactNode }) {
  const { user, loading, accessToken, signIn, signOut } = useAuth();

  // When unauthenticated, kick off the Cognito redirect immediately. Cognito's
  // Hosted UI is the only entry point — there is no in-app sign-in form.
  useEffect(() => {
    if (!loading && !user) {
      void signIn();
    }
  }, [loading, user, signIn]);

  const profile = (user?.profile ?? {}) as Record<string, unknown>;
  const email = (profile.email as string | undefined) ?? null;
  const emailVerified = profile.email_verified === true;
  const domainOk = emailDomainAllowed(email);

  // Pricing values live server-side so the static JS bundle ships no numbers.
  // Fetch the catalog once the caller is a verified Datadog user, before any
  // child route renders — resolvePrice / siemTierForTb throw without it.
  const [catalogReady, setCatalogReady] = useState(isPricingCatalogLoaded());
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !emailVerified || !domainOk) return;
    if (isPricingCatalogLoaded()) {
      setCatalogReady(true);
      return;
    }
    let cancelled = false;
    workloadApi
      .getPricing(accessToken)
      .then((r) => {
        if (cancelled) return;
        setPricingCatalog({
          pricing: r.pricing,
          siemTiers: r.siemTiers.map((t) => ({
            ...t,
            maxTb: t.maxTb ?? Number.POSITIVE_INFINITY,
          })),
        });
        // The store was created at module init with no catalog, so derived
        // state (sheet line items) is empty. Recompute now that prices exist.
        useStrategyStore.getState().recomputeDerived();
        setCatalogReady(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setCatalogError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, emailVerified, domainOk]);

  if (loading) return <CenteredMessage>Loading…</CenteredMessage>;
  if (!user) return <CenteredMessage>Redirecting to sign in…</CenteredMessage>;

  if (!emailVerified) {
    return <Navigate to="/auth/resend" replace />;
  }

  if (!domainOk) {
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

  if (catalogError) {
    return (
      <CenteredMessage>
        <h2 style={{ margin: "0 0 8px" }}>Couldn't load pricing</h2>
        <p style={{ margin: "0 0 16px", maxWidth: 420 }}>{catalogError}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={btnStyle}
        >
          Reload
        </button>
      </CenteredMessage>
    );
  }

  if (!catalogReady) return <CenteredMessage>Loading pricing…</CenteredMessage>;

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
