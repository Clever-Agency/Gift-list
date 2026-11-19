import "server-only";

import type { ActionResult, GiftReservationWarning } from "@gift-list/contracts";
import { prisma } from "@/db/client";
import { reservationWarning } from "@/domain/gift-status";
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
 * existed or who held it. The owner's preflight and release share it for a
 * foreign or unknown id.
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

/**
 * Story 5.2 (FR-31, AD-12): the owner's preflight before releasing a foreign
 * reservation. It answers the warning and nothing else — no holder, no due
 * date, no phase and no `bought`.
 *
 * Until Story 5.7 the only answer is `BOUGHT` or `null`; a wish that is no
 * longer `RESERVED` warns about nothing. The preflight only reads: a stale
 * `null` is harmless, because the release decides on its own, so the owner's
 * confirm does not break when the holder released the wish in the meantime.
 */
export async function previewReservationRelease(
  headers: Headers,
  giftId: string,
): Promise<ActionResult<GiftReservationWarning>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const stored = await prisma.gift.findFirst({
    where: { id: giftId, list: { ownerId: session.user.id } },
    select: { status: true, reservationBought: true },
  });
  if (!stored) return notFound;

  return { ok: true, data: { warning: reservationWarning(stored) } };
}

/**
 * Story 5.2 (FR-17, AD-8, AD-9): the owner releases somebody else's reservation
 * in any phase through the same CAS and the same cleared columns as the holder.
 *
 * Ownership is part of the `where`, so a foreign id writes nothing. A lost CAS
 * is re-read inside the owner's own list: no row means the wish is foreign or
 * gone (NOT_FOUND), a row means somebody was faster — the holder released it or
 * the wish was closed (CONFLICT, the list is read again).
 */
export async function releaseReservationAsOwner(
  headers: Headers,
  giftId: string,
): Promise<ActionResult<{ id: string }>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const actorId = session.user.id;
  const now = new Date();
  const outcome = await runGiftStatusTransaction(function releaseOwnerReservation(service) {
    return service.releaseReservationByOwner(giftId, actorId, now);
  });
  if (outcome === "success") return { ok: true, data: { id: giftId } };

  const existing = await prisma.gift.findFirst({
    where: { id: giftId, list: { ownerId: actorId } },
    select: { status: true },
  });
  if (!existing) return notFound;

  return conflict;
}
