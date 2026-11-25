import "server-only";

import type { ActionResult } from "@gift-list/contracts";
import { prisma } from "@/db/client";
import { auth } from "@/lib/auth";
import { runGiftStatusTransaction } from "@/lib/gift-status-store";

const unauthenticated = {
  ok: false as const,
  code: "UNAUTHENTICATED" as const,
  message: "Authentication required",
};

/**
 * Story 5.2 / AD-7: one body for every refusal a non-holder can get. An unknown
 * id, a wish held by somebody else, a reservation already released and a closed
 * wish are indistinguishable, so the route never hints that a reservation
 * existed or who held it.
 */
const notFound = {
  ok: false as const,
  code: "NOT_FOUND" as const,
  message: "Gift not found",
};

/** The CAS lost: the reservation was released or the wish closed in the meantime. */
const conflict = {
  ok: false as const,
  code: "CONFLICT" as const,
  message: "The reservation is already gone",
};

/**
 * Story 5.2 (FR-17, FR-25, A-14, AD-8, AD-9): the holder releases their own
 * reservation through the only writer of reservation columns.
 *
 * Visibility is deliberately not checked here: after an unfriend or a block the
 * holder loses access to the wish but keeps control of the reservation, so the
 * release still passes. Everything that is not a live reservation of this actor
 * answers NOT_FOUND with the same body — the route exists only for the holder,
 * so FORBIDDEN or a different status would expose the reservation (AD-7).
 *
 * The answer is `{ id }`, not the card: the holder may have lost access to the
 * wish by AD-7, and the card would then return fields he can no longer see. The
 * client applies the known `RESERVED → OPEN` transition locally.
 */
export async function releaseMyReservation(
  headers: Headers,
  giftId: string,
): Promise<ActionResult<{ id: string }>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const actorId = session.user.id;
  const held = await prisma.gift.findFirst({
    where: { id: giftId, status: "RESERVED", reservedById: actorId },
    select: { id: true },
  });
  if (!held) return notFound;

  const now = new Date();
  const outcome = await runGiftStatusTransaction(function releaseHolderReservation(service) {
    return service.releaseReservationByHolder(giftId, actorId, now);
  });
  if (outcome === "lost") return conflict;

  return { ok: true, data: { id: giftId } };
}
