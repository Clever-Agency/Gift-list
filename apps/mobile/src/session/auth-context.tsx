import type { Me } from "@gift-list/contracts";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { apiRequest } from "@/api/client";
import { clearSessionToken } from "@/platform/session-token";
import { forgetAuthEmail } from "@/session/auth-navigation";
import { deviceTimeZone } from "@/session/device-time-zone";

/**
 * The session read has four outcomes. `anonymous` means the server answered
 * `UNAUTHENTICATED`; `error` means the answer never proved anything about the
 * session (no network, a timeout or a broken response), so the app must not
 * pretend the visitor is signed out. Public screens continue as a guest and
 * guarded screens offer a retry instead of sending the user to login.
 */
type AuthState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "ready"; user: Me }
  | { status: "error" };

type AuthContextValue = {
  state: AuthState;
  setUser: (user: Me) => void;
  signOut: () => Promise<{ ok: true } | { ok: false; network: true }>;
  /** Reread `/api/v1/me` after a network failure; also used by retry views. */
  retry: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const attempted = useRef<string | null>(null);

  const retry = useCallback(function retrySessionRead() {
    // A retry starts from the loading state, so a guarded screen shows the shared
    // skeleton while the second read is in flight instead of the stale error.
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  }, []);

  useEffect(function loadSession() {
    let cancelled = false;

    async function requestMe() {
      const result = await apiRequest<Me>("/api/v1/me");
      if (cancelled) return;
      if (result.ok) {
        setState({ status: "ready", user: result.data });
        return;
      }
      if (!("network" in result) && result.code === "UNAUTHENTICATED") {
        await clearSessionToken();
        if (cancelled) return;
        setState({ status: "anonymous" });
        return;
      }
      // Anything else — a timeout, a broken envelope or a transient API error —
      // leaves the stored token alone and is not proof that the visitor is a guest.
      setState({ status: "error" });
    }

    void requestMe();
    return function stopSessionLoad() {
      cancelled = true;
    };
  }, [attempt]);

  useEffect(function syncTimeZone() {
    if (state.status !== "ready" || state.user.timeZone) return;
    if (attempted.current === state.user.id) return;
    attempted.current = state.user.id;
    const userId = state.user.id;
    const zone = deviceTimeZone();

    async function putTimeZone() {
      const result = await apiRequest<{ timeZone: string }>("/api/v1/me/time-zone", {
        method: "PUT",
        body: { timeZone: zone ?? "" },
      });
      if (!result.ok) return;
      setState((current) => {
        if (current.status !== "ready" || current.user.id !== userId) return current;
        return { status: "ready", user: { ...current.user, timeZone: result.data.timeZone } };
      });
    }

    void putTimeZone();
  }, [state]);

  const value = useMemo<AuthContextValue>(function createAuthValue() {
    function setUser(user: Me) {
      setState({ status: "ready", user });
    }

    async function signOut(): Promise<{ ok: true } | { ok: false; network: true }> {
      const result = await apiRequest<{ signedOut: true }>("/api/v1/session", {
        method: "DELETE",
      });
      if (!result.ok && "network" in result) return { ok: false, network: true };
      await clearSessionToken();
      forgetAuthEmail();
      attempted.current = null;
      setState({ status: "anonymous" });
      return { ok: true };
    }

    return { state, setUser, signOut, retry };
  }, [state, retry]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

AuthProvider.displayName = "AuthProvider";

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth requires AuthProvider");
  return value;
}
