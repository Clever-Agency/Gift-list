import {
  friendAcceptDataSchema,
  friendInviteDataSchema,
  friendRejectDataSchema,
  type FriendAcceptOutcome,
  type FriendInviteOutcome,
  type FriendRejectOutcome,
} from "@gift-list/contracts";
import { apiRequest, type ClientResult } from "@/api/client";
import { profileRoute } from "@/profile/profile-route";

type OutcomeResult<T extends string> =
  | { ok: true; outcome: T }
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

/**
 * Story 4.1.2 / AD-10, AD-12: the same closed outcome set the instance returns.
 * `PENDING` and `ALREADY_FRIENDS` are successful no-ops, not errors.
 */
export type FriendInviteResult = OutcomeResult<FriendInviteOutcome>;

/** Story 4.2.2: a closed accept outcome or a failed request. */
export type FriendAcceptResult = OutcomeResult<FriendAcceptOutcome>;

/** Story 4.2.2: the closed `REJECTED` acknowledgement or a failed request. */
export type FriendRejectResult = OutcomeResult<FriendRejectOutcome>;

/** The closed success envelope every invite action answers with. */
type OutcomeSchema<T extends string> = {
  safeParse: (
    value: unknown,
  ) => { success: true; data: { outcome: T } } | { success: false };
};

/**
 * Story 4.1.3 / 4.2.3: one POST to the action segment of exactly one nick. The
 * body is not sent: the target is only the nick in the path, mirroring the
 * server adapter. A malformed segment is rejected before a request, like the
 * profile read and the server route.
 */
async function postFriendAction<T extends string>(
  nick: string,
  action: "invite" | "accept" | "reject",
  schema: OutcomeSchema<T>,
): Promise<OutcomeResult<T>> {
  const route = profileRoute(nick);
  if (route === null) return { ok: false, invalid: true };

  const suffix = action === "invite" ? "invite" : `invite/${action}`;
  const result = await apiRequest<unknown>(
    `/api/v1/u/${encodeURIComponent(route.nick)}/${suffix}`,
    { method: "POST" },
  );
  if (!result.ok) return result;

  const parsed = schema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true, outcome: parsed.data.outcome };
}

/** Story 4.1.3: a first invite; a reverse pending invite auto-accepts it. */
export function sendFriendInvite(nick: string): Promise<FriendInviteResult> {
  return postFriendAction(nick, "invite", friendInviteDataSchema);
}

/** Story 4.2.3: explicitly accept the incoming invite from this nick. */
export function acceptFriendInvite(nick: string): Promise<FriendAcceptResult> {
  return postFriendAction(nick, "accept", friendAcceptDataSchema);
}

/** Story 4.2.3: explicitly reject the incoming invite from this nick. */
export function rejectFriendInvite(nick: string): Promise<FriendRejectResult> {
  return postFriendAction(nick, "reject", friendRejectDataSchema);
}
