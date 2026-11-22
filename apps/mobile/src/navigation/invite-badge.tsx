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
import { fetchInvites } from "@/api/circle";
import { useAuth } from "@/session/auth-context";

/** What the shell's «Друзья» badge knows and how a screen asks for a fresh count. */
export type InviteBadgeValue = {
  /**
   * Incoming friend requests from the last successful read. `null` means «no
   * badge»: before the first answer, for a visitor without a session, and when
   * the server answered `UNAUTHENTICATED`.
   */
  count: number | null;
  /**
   * Reads `/me/invites` again. The screens call it after their own action on a
   * request (accept, reject, cancel) and after a manual refresh of «Друзья»;
   * without a session it does nothing.
   */
  refresh: () => void;
};

const InviteBadgeContext = createContext<InviteBadgeValue | null>(null);

/**
 * Story 6.2 (CLE-117): the number of incoming friend requests on the «Друзья»
 * tab and sidebar item. The count already exists in `GET /api/v1/me/invites`
 * (`incomingCount`), so the provider reads that route once when the session is
 * ready and on `refresh()` — no new server route, no polling, no push (Story
 * 6.1 owns those). A failed read is silent: the badge is a hint, not an error
 * surface, and navigation keeps working.
 */
export function InviteBadgeProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  // The count is stored together with the person it belongs to: a number left
  // from the session that just ended is never handed to the next one.
  const [known, setKnown] = useState<{ userId: string; count: number } | null>(null);
  // An action on «Друзья» can start a second read while the first is in flight;
  // only the newest answer may land.
  const newest = useRef(0);
  const signedInAs = auth.state.status === "ready" ? auth.state.user.id : null;
  const count =
    signedInAs !== null && known !== null && known.userId === signedInAs
      ? known.count
      : null;

  const read = useCallback(function readInviteCount(userId: string) {
    const id = ++newest.current;
    void fetchInvites().then(function applyInviteCount(result) {
      if (id !== newest.current) return;
      if (result.ok) {
        setKnown({ userId, count: result.invites.incomingCount });
        return;
      }
      if ("code" in result && result.code === "UNAUTHENTICATED") {
        // A dead session has nothing to count; the screen guard owns the sign-out.
        setKnown(null);
      }
      // Any other failure — the network, a broken envelope, a failed contract —
      // keeps the last known number, and before the first answer there is none.
    });
  }, []);

  useEffect(
    function readOncePerSession() {
      // A visitor without a session has nothing to count, and an answer from the
      // session that just ended must not land on the next one.
      if (signedInAs === null) {
        newest.current += 1;
        return;
      }
      read(signedInAs);
      return function ignoreLateAnswer() {
        newest.current += 1;
      };
    },
    [signedInAs, read],
  );

  const refresh = useCallback(
    function refreshInviteCount() {
      if (signedInAs === null) return;
      read(signedInAs);
    },
    [signedInAs, read],
  );

  const value = useMemo<InviteBadgeValue>(
    function createInviteBadgeValue() {
      return { count, refresh };
    },
    [count, refresh],
  );

  return (
    <InviteBadgeContext.Provider value={value}>
      {children}
    </InviteBadgeContext.Provider>
  );
}

InviteBadgeProvider.displayName = "InviteBadgeProvider";

export function useInviteBadge(): InviteBadgeValue {
  const value = useContext(InviteBadgeContext);
  if (!value) throw new Error("useInviteBadge requires InviteBadgeProvider");
  return value;
}

/**
 * The same count for a screen that may be mounted outside the shell (a screen
 * unit test, a standalone preview): without `InviteBadgeProvider` it answers
 * `null` instead of throwing, so «Друзья» keeps working and simply asks nobody for
 * a fresh count. In the app the provider is always above the tabs, so the screen
 * gets the real `refresh()`.
 */
export function useInviteBadgeOptional(): InviteBadgeValue | null {
  return useContext(InviteBadgeContext);
}
