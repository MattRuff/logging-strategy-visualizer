import { UserManager, WebStorageStateStore, type User } from "oidc-client-ts";
import { runtime } from "@/config/runtime";

let cached: UserManager | null = null;

export function getUserManager(): UserManager {
  if (cached) return cached;

  const redirectUri = `${window.location.origin}/auth/callback`;
  const postLogoutRedirectUri = `${window.location.origin}/`;

  // Cognito's OIDC discovery doc lives at cognito-idp.<region>.amazonaws.com/<userPoolId>/.well-known/openid-configuration
  // and already includes the hosted-UI authorize/token/end_session endpoints — no manual override needed.
  cached = new UserManager({
    authority: `https://cognito-idp.${runtime.cognitoRegion}.amazonaws.com/${runtime.cognitoUserPoolId}`,
    client_id: runtime.cognitoClientId,
    redirect_uri: redirectUri,
    post_logout_redirect_uri: postLogoutRedirectUri,
    response_type: "code",
    scope: "openid email profile",
    userStore: new WebStorageStateStore({ store: window.localStorage }),
  });

  return cached;
}

export async function signIn(): Promise<void> {
  await getUserManager().signinRedirect();
}

export async function handleCallback(): Promise<User> {
  return getUserManager().signinRedirectCallback();
}

export async function signOut(): Promise<void> {
  await getUserManager().signoutRedirect();
}

export async function getCurrentUser(): Promise<User | null> {
  return getUserManager().getUser();
}
