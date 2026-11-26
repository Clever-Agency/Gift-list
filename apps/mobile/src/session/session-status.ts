import { createContext, useContext } from "react";

/** The session outcomes `/api/v1/me` can end with (see `auth-context`). */
export type SessionStatus = "loading" | "anonymous" | "ready" | "error";

/**
 * The read-only slice of the session that shared chrome needs (`SiteFooter`,
 * D-53). It lives apart from `auth-context` on purpose: the footer is rendered by
 * every screen, and importing the provider module would drag the API client and
 * its platform modules into stories and component tests that only paint chrome.
 *
 * `AuthProvider` publishes the current status here; no request is made.
 */
export const SessionStatusContext = createContext<SessionStatus | null>(null);

/** `null` means "no provider above": the caller keeps its guest default. */
export function useSessionStatus(): SessionStatus | null {
  return useContext(SessionStatusContext);
}
