import "server-only";

import type { ActionResult, FriendRemoveData } from "@gift-list/contracts";
import { removeFriend } from "@/domain/friendship";
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
 * A self pair and a Block in either direction share one refusal (AD-12, FR-24),
 * exactly like the neighbouring invite and subscription mutations. No
 * `ERROR_REASONS` value is invented: the client shows the generic `FORBIDDEN`
 * text, and both successful outcomes are not errors at all.
 */
const forbidden = {
  ok: false as const,
  code: "FORBIDDEN" as const,
  message: "Forbidden",
};

/**
 * Story 4.4 (FR-23, AD-10 step 4): either side of an accepted friendship removes
 * it. The session user is the actor (`viewerId`), the path nick is the other
 * side of the edge (`otherUserId`), so neither the body nor another user id can
 * choose the pair; the body is not read.
 *
 * The nick goes through the same `findUserIdByNick` gate as the invite routes:
 * case does not matter, and an unknown, renamed or malformed nick is one closed
 * `NOT_FOUND` without a name. Existence of the edge is not a check here — the
 * domain answers `REMOVED` or the idempotent `ALREADY_REMOVED`, both 200. A
 * `Block` in either direction and a self pair are `FORBIDDEN` without a reason
 * and write nothing. Subscriptions, blocks and the invite cooldown stay
 * untouched; a new friendship appears only through a newly accepted invite.
 */
export async function removeFriendByNick(
  nick: string,
  headers: Headers,
): Promise<ActionResult<FriendRemoveData>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const otherUserId = await findUserIdByNick(nick);
  if (otherUserId === null) return notFound;

  const result = await removeFriend(
    { viewerId: session.user.id, otherUserId },
    friendshipStore,
  );
  if (!result.ok) return forbidden;

  return { ok: true, data: { outcome: result.outcome } };
}
