import type { Me } from "@gift-list/contracts";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { apiRequest } from "@/api/client";
import { clearSessionToken } from "@/platform/session-token";
import { deviceTimeZone } from "@/session/device-time-zone";

type AuthState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "ready"; user: Me };

type AuthContextValue = {
  state: AuthState;
  setUser: (user: Me) => void;
  signOut: () => Promise<{ ok: true } | { ok: false; network: true }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const attempted = useRef<string | null>(null);

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
      }
      setState({ status: "anonymous" });
    }

    void requestMe();
    return function stopSessionLoad() {
      cancelled = true;
    };
  }, []);

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
      attempted.current = null;
      setState({ status: "anonymous" });
      return { ok: true };
    }

    return { state, setUser, signOut };
  }, [state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth requires AuthProvider");
  return value;
}
