// API Gateway HTTP API JWT authorizer pre-validates the Cognito access token and
// places its claims on event.requestContext.authorizer.jwt.claims. Handlers only
// read from there — they do not re-verify the JWT.

export function getCallerSub(event) {
  const claims = event?.requestContext?.authorizer?.jwt?.claims;
  if (!claims?.sub) {
    const err = new Error("Missing sub claim");
    err.statusCode = 401;
    throw err;
  }
  return String(claims.sub);
}

export function getCallerEmail(event) {
  return event?.requestContext?.authorizer?.jwt?.claims?.email ?? null;
}
