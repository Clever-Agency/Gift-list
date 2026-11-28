import type { ActionError, Me } from "@gift-list/contracts";
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
import { openSessionEvents } from "@/platform/session-events";
import { clearSessionToken } from "@/platform/session-token";
import { forgetAuthEmail } from "@/session/auth-navigation";
import { deviceTimeZone } from "@/session/device-time-zone";
import { SessionStatusContext } from "@/session/session-status";

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
  /** Capture before a session POST so its response can be reconciled with cross-tab changes. */
  getSessionRevision: () => number;
  /** Installs the user after login or registration creates a session. */
  setUser: (user: Me, revision?: number) => void;
  updateUser: (user: Me) => void;
  signOut: () => Promise<{ ok: true } | { ok: false; network: true } | ActionError>;
  /**
   * The session is already dead on the server (the account was just deleted):
   * drop the local token and pending hand-offs, then turn the app anonymous
   * without a second request.
   */
  signOutLocally: () => Promise<void>;
  /** Reread `/api/v1/me` after a network failure; also used by retry views. */
  retry: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const readRevision = useRef(0);
  const remoteSessionRevision = useRef(0);
  const attempted = useRef<string | null>(null);
  const sessionEvents = useRef<ReturnType<typeof openSessionEvents>>(null);

  const retry = useCallback(function retrySessionRead() {
    // A retry starts from the loading state, so a guarded screen shows the shared
    // skeleton while the second read is in flight instead of the stale error.
    setState({ status: "loading" });
    setAttempt(++readRevision.current);
  }, []);

  useEffect(function subscribeToSessionChanges() {
    const events = openSessionEvents(function receiveSessionChange() {
      remoteSessionRevision.current++;
      retry();
    });
    sessionEvents.current = events;
    return function stopSessionEvents() {
      sessionEvents.current = null;
      events?.close();
    };
  }, [retry]);

  useEffect(function loadSession() {
    let cancelled = false;

    function isCurrentRead() {
      return !cancelled && attempt === readRevision.current;
    }

    async function requestMe() {
      const result = await apiRequest<Me>("/api/v1/me");
      if (!isCurrentRead()) return;
      if (result.ok) {
        setState({ status: "ready", user: result.data });
        return;
      }
      if (!("network" in result) && result.code === "UNAUTHENTICATED") {
        await clearSessionToken();
        if (!isCurrentRead()) return;
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
    function getSessionRevision() {
      return remoteSessionRevision.current;
    }

    function completeSessionChange(next: AuthState, revision: number, publish: boolean) {
      if (revision !== remoteSessionRevision.current) {
        retry();
      } else {
        readRevision.current++;
        setState(next);
      }
      if (publish) sessionEvents.current?.publish();
    }

    function setUser(user: Me, revision = getSessionRevision()) {
      completeSessionChange({ status: "ready", user }, revision, true);
    }

    function updateUser(user: Me) {
      setState(function applyProfileUpdate(current) {
        if (current.status !== "ready" || current.user.id !== user.id) return current;
        return { status: "ready", user };
      });
    }

    /**
     * Drops the local session: the token and the pending hand-offs go, and the
     * app turns anonymous. `publish` is set only when the server already
     * confirmed the change, so the other tabs learn about it.
     */
    async function forgetSession(revision: number, publish: boolean): Promise<void> {
      await clearSessionToken();
      forgetAuthEmail();
      attempted.current = null;
      completeSessionChange({ status: "anonymous" }, revision, publish);
    }

    /**
     * The session is already dead on the server (the account was just deleted):
     * drop it locally without a second request.
     */
    async function signOutLocally(): Promise<void> {
      await forgetSession(getSessionRevision(), true);
    }

    async function signOut(): ReturnType<AuthContextValue["signOut"]> {
      const revision = getSessionRevision();
      const result = await apiRequest<{ signedOut: true }>("/api/v1/session", {
        method: "DELETE",
      });
      if (!result.ok && ("network" in result || result.code !== "UNAUTHENTICATED")) {
        return result;
      }
      await forgetSession(revision, result.ok);
      return { ok: true };
    }

    return { state, getSessionRevision, setUser, updateUser, signOut, signOutLocally, retry };
  }, [state, retry]);

  return (
    <AuthContext.Provider value={value}>
      <SessionStatusContext.Provider value={state.status}>{children}</SessionStatusContext.Provider>
    </AuthContext.Provider>
  );
}

AuthProvider.displayName = "AuthProvider";

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth requires AuthProvider");
  return value;
}
