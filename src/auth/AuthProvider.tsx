import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "oidc-client-ts";
import {
  getCurrentUser,
  getUserManager,
  signIn,
  signOut,
} from "@/auth/authClient";

interface AuthContextValue {
  user: User | null;
  email: string | null;
  accessToken: string | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then((u) => {
        if (!cancelled) setUser(u && !u.expired ? u : null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const mgr = getUserManager();
    const onLoaded = (u: User) => setUser(u);
    const onUnloaded = () => setUser(null);
    mgr.events.addUserLoaded(onLoaded);
    mgr.events.addUserUnloaded(onUnloaded);
    mgr.events.addAccessTokenExpired(onUnloaded);

    return () => {
      cancelled = true;
      mgr.events.removeUserLoaded(onLoaded);
      mgr.events.removeUserUnloaded(onUnloaded);
      mgr.events.removeAccessTokenExpired(onUnloaded);
    };
  }, []);

  const boundSignIn = useCallback(() => signIn(), []);
  const boundSignOut = useCallback(() => signOut(), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      email: (user?.profile?.email as string | undefined) ?? null,
      accessToken: user?.access_token ?? null,
      loading,
      signIn: boundSignIn,
      signOut: boundSignOut,
    }),
    [user, loading, boundSignIn, boundSignOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
