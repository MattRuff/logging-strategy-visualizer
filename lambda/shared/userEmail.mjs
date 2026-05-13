// Resolve a caller's email even when the access-token claims don't include
// one (Cognito access tokens normally omit `email`). Tries the JWT claim
// first, then falls back to AdminGetUser on the configured user pool.
// Results are cached per-cold-start to avoid hitting Cognito on every request.

import {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { getCallerSub, getCallerEmail } from "./auth.mjs";

const POOL_ID = process.env.COGNITO_USER_POOL_ID;
const cognito = new CognitoIdentityProviderClient({});
const cache = new Map(); // sub -> email

export async function resolveCallerEmail(event) {
  const claim = getCallerEmail(event);
  if (claim) return claim;
  if (!POOL_ID) return null;
  const sub = getCallerSub(event);
  if (cache.has(sub)) return cache.get(sub);
  try {
    const res = await cognito.send(new AdminGetUserCommand({
      UserPoolId: POOL_ID,
      Username: sub,
    }));
    const attr = (res.UserAttributes ?? []).find((a) => a.Name === "email");
    const email = attr?.Value ?? null;
    cache.set(sub, email);
    return email;
  } catch {
    cache.set(sub, null);
    return null;
  }
}
