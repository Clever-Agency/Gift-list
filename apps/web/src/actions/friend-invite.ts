import "server-only";

import type { ActionResult, FriendInviteData } from "@gift-list/contracts";
import { prisma } from "@/db/client";
import { sendFriendInvite } from "@/domain/friendship";
import { isValidNick, normalizeNick } from "@/domain/nick";
import { auth } from "@/lib/auth";
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
 */
export async function sendInviteByNick(
  nick: string,
  headers: Headers,
): Promise<ActionResult<FriendInviteData>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const nickNormalized = normalizeNick(nick);
  if (!isValidNick(nickNormalized)) return notFound;

  const owner = await prisma.user.findUnique({
    where: { nickNormalized },
    select: { id: true },
  });
  if (owner === null) return notFound;

  const result = await sendFriendInvite(
    { fromUserId: session.user.id, toUserId: owner.id },
    friendshipStore,
  );
  // The domain refusal carries SELF_INVITE/BLOCKED for tests; the wire keeps one
  // closed FORBIDDEN answer and never says which one happened.
  if (!result.ok) return forbidden;

  return { ok: true, data: { outcome: result.outcome } };
}
