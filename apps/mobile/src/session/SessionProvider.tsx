import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from "react";
import type { ReactNode } from "react";
import { meSchema, type Me } from "@gift-list/contracts";
import { apiRequest } from "@/api/client";
import { clearSessionToken } from "@/platform/session-token";
import { INITIAL_SESSION, loadSession, sessionReducer, type SessionState } from "./session-state";

export type Session = {
  status: SessionState["status"];
  me?: Me;
  refresh: () => void;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(sessionReducer, INITIAL_SESSION);
  const [attempt, bump] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    let active = true;
    void loadSession({
      request: () => apiRequest("/api/v1/me", meSchema),
      clearToken: clearSessionToken,
    }).then((result) => {
      if (active) dispatch({ type: "result", result });
    });
    return () => {
      active = false;
    };
  }, [attempt]);

  const refresh = useCallback(() => {
    dispatch({ type: "refresh" });
    bump();
  }, []);

  const value = useMemo<Session>(
    () => ({
      status: state.status,
      me: state.status === "authenticated" ? state.me : undefined,
      refresh,
    }),
    [state, refresh],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
