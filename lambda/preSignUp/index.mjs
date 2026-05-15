// Cognito PreSignUp trigger. Rejects any sign-up whose email isn't in the
// allowed-domain list. Cognito surfaces the thrown error message to the user
// in the Hosted UI, so keep it short and human-readable.

const ALLOWED = (process.env.ALLOWED_EMAIL_DOMAINS ?? "datadoghq.com")
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

function emailDomainAllowed(email) {
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  const domain = email.slice(at + 1).toLowerCase();
  return ALLOWED.includes(domain);
}

export const handler = async (event) => {
  const email = String(event?.request?.userAttributes?.email ?? "").trim();
  if (!email || !emailDomainAllowed(email)) {
    throw new Error("Only Datadog email addresses are allowed.");
  }
  return event;
};
