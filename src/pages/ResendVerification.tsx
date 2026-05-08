import { useState } from "react";
import { Link } from "react-router-dom";
import { datadogRum } from "@datadog/browser-rum";
import { runtime } from "@/config/runtime";

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; destination?: string }
  | { kind: "confirming" }
  | { kind: "confirmed" }
  | { kind: "error"; message: string };

async function cognitoCall<T>(action: string, body: Record<string, unknown>): Promise<T> {
  const endpoint = `https://cognito-idp.${runtime.cognitoRegion}.amazonaws.com/`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": `AWSCognitoIdentityProviderService.${action}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const msg = data.message || data.__type || `Cognito ${action} failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

export function ResendVerification() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onResend(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus({ kind: "sending" });
    datadogRum.addAction("auth.resend_code.requested", { email_domain: email.split("@")[1] });
    try {
      const data = await cognitoCall<{ CodeDeliveryDetails?: { Destination?: string } }>(
        "ResendConfirmationCode",
        { ClientId: runtime.cognitoClientId, Username: email.trim() }
      );
      setStatus({ kind: "sent", destination: data.CodeDeliveryDetails?.Destination });
      datadogRum.addAction("auth.resend_code.sent");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      datadogRum.addError(err instanceof Error ? err : new Error(message), {
        flow: "auth_resend_code",
      });
      setStatus({ kind: "error", message });
    }
  }

  async function onConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !code) return;
    setStatus({ kind: "confirming" });
    datadogRum.addAction("auth.confirm_code.requested");
    try {
      await cognitoCall("ConfirmSignUp", {
        ClientId: runtime.cognitoClientId,
        Username: email.trim(),
        ConfirmationCode: code.trim(),
      });
      setStatus({ kind: "confirmed" });
      datadogRum.addAction("auth.confirm_code.success");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      datadogRum.addError(err instanceof Error ? err : new Error(message), {
        flow: "auth_confirm_code",
      });
      setStatus({ kind: "error", message });
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 480, margin: "48px auto", fontFamily: "system-ui" }}>
      <h2 style={{ marginTop: 0 }}>Verify your account</h2>
      <p style={{ color: "#444" }}>
        Didn't get a verification email, or the code expired? Enter your email below to get a new
        code, then enter the code to confirm your account.
      </p>

      <form onSubmit={onResend} style={{ marginTop: 16 }}>
        <label style={label}>Email</label>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={input}
          placeholder="you@example.com"
        />
        <button
          type="submit"
          disabled={status.kind === "sending" || !email}
          style={primaryBtn}
        >
          {status.kind === "sending" ? "Sending…" : "Send new code"}
        </button>
      </form>

      {(status.kind === "sent" || status.kind === "confirming" || status.kind === "confirmed") && (
        <form onSubmit={onConfirm} style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #eee" }}>
          {status.kind === "sent" && status.destination && (
            <p style={{ color: "#0a0", fontSize: 14 }}>
              Code sent to {status.destination}. Check your inbox and spam folder.
            </p>
          )}
          <label style={label}>Verification code</label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={input}
            placeholder="123456"
          />
          <button
            type="submit"
            disabled={status.kind === "confirming" || status.kind === "confirmed" || !code}
            style={primaryBtn}
          >
            {status.kind === "confirming" ? "Confirming…" : "Confirm account"}
          </button>
          {status.kind === "confirmed" && (
            <p style={{ color: "#0a0", marginTop: 12 }}>
              Your account is confirmed. <Link to="/">Return home</Link> and sign in.
            </p>
          )}
        </form>
      )}

      {status.kind === "error" && (
        <p style={{ color: "#a00", marginTop: 16 }}>{status.message}</p>
      )}

      <p style={{ marginTop: 32, fontSize: 13 }}>
        <Link to="/">← Back to home</Link>
      </p>
    </div>
  );
}

const label: React.CSSProperties = { display: "block", fontSize: 13, color: "#444", marginBottom: 4 };
const input: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "8px 10px",
  border: "1px solid #ccc",
  borderRadius: 4,
  marginBottom: 12,
  fontSize: 14,
  boxSizing: "border-box",
};
const primaryBtn: React.CSSProperties = {
  background: "#632ca6",
  color: "white",
  border: 0,
  padding: "8px 14px",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 14,
};
