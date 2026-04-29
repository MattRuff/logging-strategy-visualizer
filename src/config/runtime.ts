// Runtime configuration sourced from Vite env vars at build time.
// In CI, the deploy workflow injects these via .env.production before `vite build`.
// For local dev, populate .env.local at the repo root.

export const runtime = {
  cognitoUserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID ?? "",
  cognitoClientId: import.meta.env.VITE_COGNITO_CLIENT_ID ?? "",
  cognitoDomain: import.meta.env.VITE_COGNITO_DOMAIN ?? "",
  cognitoRegion: import.meta.env.VITE_COGNITO_REGION ?? "us-east-1",
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "/api",
  /** Build version (commit SHA in CI) — used as RUM `version` for source-code correlation. */
  buildVersion: import.meta.env.VITE_BUILD_VERSION ?? "dev",
};

export function assertConfigured() {
  const missing: string[] = [];
  if (!runtime.cognitoUserPoolId) missing.push("VITE_COGNITO_USER_POOL_ID");
  if (!runtime.cognitoClientId) missing.push("VITE_COGNITO_CLIENT_ID");
  if (!runtime.cognitoDomain) missing.push("VITE_COGNITO_DOMAIN");
  if (missing.length > 0) {
    throw new Error(
      `App is missing runtime config: ${missing.join(", ")}. ` +
        `Set these in .env.local for dev or .env.production for the build (or via the deploy workflow for prod).`
    );
  }
}
