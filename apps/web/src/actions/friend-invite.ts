import "server-only";

import type {
  ActionResult,
  FriendAcceptData,
  FriendInviteData,
  FriendRejectData,
} from "@gift-list/contracts";
import {
  acceptFriendInvite,
  rejectFriendInvite,
  sendFriendInvite,
} from "@/domain/friendship";
import { auth } from "@/lib/auth";
import { findUserIdByNick } from "@/lib/find-user-by-nick";
import { friendshipStore } from "@/lib/friendship-store";

const unauthenticated = {
  ok: false as const,
  code: "UNAUTHENTICATED" as const,
  message: "Authentication required",
};

/** Unknown, old or malformed nick: the same closed answer, without a name. */
const notFound = {
  ok: false as const,
  code: "NOT_FOUND" as const,
  message: "Not found",
};

/**
 * Self-invite and a Block in either direction share one refusal (AD-12, FR-24).
 * Neither `ERROR_REASONS` value is invented: the client shows the generic
 * `FORBIDDEN` text, and a successful no-op is not an error at all.
 */
const forbidden = {
  ok: false as const,
  code: "FORBIDDEN" as const,
  message: "Forbidden",
};

/**
 * Story 4.1.2 (AD-10, AD-12, ARCH-A12): a signed-in user invites somebody by
 * nick. The route resolves exactly one path segment to this function, so the
 * target can never come from a request body or an arbitrary user id.
 *
 * The nick goes through the same `normalizeNick` gate as `GET /api/v1/u/:nick`:
 * case does not matter and a nick left behind by a rename does not resolve. The
 * closed protocol outcomes are returned unchanged; a repeat pending and an
 * existing friendship are successful no-ops. All checks and writes belong to
 * `sendFriendInvite`, including the canonical-pair lock of Story 4.1.1 R1, so
 * this adapter cannot regress the concurrency protocol.
 *
 * Story 4.2.2: a live rejection cooldown is not collapsed into `FORBIDDEN` any
 * more. It keeps the closed `RATE_LIMITED` code and carries the machine-readable
 * `reason: INVITE_COOLDOWN` with `params: { hours }`, so the client can show
 * "Можно снова через {hours} ч" instead of the generic rate-limit text.
 */
export async function sendInviteByNick(
  nick: string,
  headers: Headers,
): Promise<ActionResult<FriendInviteData>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const ownerId = await findUserIdByNick(nick);
  if (ownerId === null) return notFound;

  const result = await sendFriendInvite(
    { fromUserId: session.user.id, toUserId: ownerId },
    friendshipStore,
  );
  if (!result.ok) {
    if (result.code === "RATE_LIMITED") {
      return {
        ok: false,
        code: "RATE_LIMITED",
        message: "Invite cooldown is active",
        reason: "INVITE_COOLDOWN",
        params: { hours: result.hours },
      };
    }
    // The domain refusal carries SELF_INVITE/BLOCKED for tests; the wire keeps
    // one closed FORBIDDEN answer and never says which one happened.
    return forbidden;
  }

  return { ok: true, data: { outcome: result.outcome } };
}

/**
 * Story 4.2.2 (FR-14, AD-10 step 2): the recipient of the pending invite from
 * the nick's owner accepts it. The session user is the recipient (`viewerId`),
 * the path nick is the inviter (`fromUserId`), so neither the body nor another
 * user id can choose the pair.
 *
 * Acceptance uses the domain protocol of Story 4.2.1 unchanged: one canonical
 * edge, all pair invites deleted, the pair's cooldown cleared, under the same
 * pair lock. Success mirrors the reverse-pending auto-accept: `FRIENDS_CREATED`
 * or `ALREADY_FRIENDS`. Missing pending, a non-recipient, a renamed nick and a
 * self pair are the same closed `NOT_FOUND`; a Block is `FORBIDDEN` without a
 * reason and writes nothing.
 */
export async function acceptInviteByNick(
  nick: string,
  headers: Headers,
): Promise<ActionResult<FriendAcceptData>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const ownerId = await findUserIdByNick(nick);
  if (ownerId === null) return notFound;

  const result = await acceptFriendInvite(
    { fromUserId: ownerId, viewerId: session.user.id },
    friendshipStore,
  );
  if (!result.ok) {
    return result.code === "FORBIDDEN" ? forbidden : notFound;
  }

  return { ok: true, data: { outcome: result.outcome } };
}

/**
 * Story 4.2.2 (FR-14, AD-10 step 3): the recipient rejects the pending invite
 * from the nick's owner. Rejection is recipient-only: the sender calling this
 * route has no pending row in the requested direction, so it answers the same
 * closed `NOT_FOUND` and never writes a cooldown (a sender-side cancel is Story
 * 4.3).
 *
 * Success is the closed `REJECTED` acknowledgement; the domain has already
 * deleted exactly that invite and written one 24-hour cooldown row. A Block is
 * `FORBIDDEN` without a reason and writes no cooldown.
 */
export async function rejectInviteByNick(
  nick: string,
  headers: Headers,
): Promise<ActionResult<FriendRejectData>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const ownerId = await findUserIdByNick(nick);
  if (ownerId === null) return notFound;

  const result = await rejectFriendInvite(
    { fromUserId: ownerId, viewerId: session.user.id },
    friendshipStore,
  );
  if (!result.ok) {
    return result.code === "FORBIDDEN" ? forbidden : notFound;
  }

  return { ok: true, data: { outcome: result.outcome } };
}
