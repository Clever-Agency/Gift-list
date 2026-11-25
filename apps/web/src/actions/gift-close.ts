import "server-only";

import { giftCardSchema, type ActionResult, type GiftCard } from "@gift-list/contracts";
import { prisma } from "@/db/client";
import type { Prisma } from "@/db/generated/client";
import { canCloseGift, canUndoClose } from "@/domain/gift-status";
import { toOwnerGiftCard } from "@/domain/owner-gift-card";
import { auth } from "@/lib/auth";
import { runGiftStatusTransaction } from "@/lib/gift-status-store";
import {
  archivedValidation,
  notFound,
  ownerGiftSelect,
  requestLocale,
  unauthenticated,
} from "@/actions/gifts";

/**
 * Story 5.3 (FR-32, AD-8): the wish is already `CLOSED`, so closing it again
 * writes nothing. `ALREADY_CLOSED` carries no `reason`: the client simply keeps
 * the closed card.
 */
const alreadyClosed = {
  ok: false as const,
  code: "CONFLICT" as const,
  message: "Gift is already closed",
};

/**
 * Story 5.3: the undo lost its CAS for a reason other than the window — the wish
 * is no longer `CLOSED`, it was closed again, or its origin status is gone
 * (`UNDO_NO_ORIGIN`). `UNDO_RACE` / `UNDO_NO_ORIGIN` carry no `reason`; the
 * client re-reads the list.
 */
const undoConflict = {
  ok: false as const,
  code: "CONFLICT" as const,
  message: "The wish is not open for undo",
};

/** Story 5.3 (`UNDO_LATE`, D-43): the ten-minute window is over. */
const undoWindowExpired = {
  ok: false as const,
  code: "CONFLICT" as const,
  message: "The undo window is closed",
  reason: "UNDO_WINDOW_EXPIRED" as const,
};

/** The closure facts the rules read; ownership already narrowed the `where`. */
const closeSelect = {
  status: true,
  archivedAt: true,
  closedAt: true,
  closedFromStatus: true,
} satisfies Prisma.GiftSelect;

/**
 * The owner's card after the write. The mutation answers the card, not `{ id }`:
 * the card is what carries `undoUntil`, so the client shows «Вернуть в открытые ·
 * ещё N мин» without re-reading the whole list.
 */
async function ownerCard(
  headers: Headers,
  giftId: string,
  ownerId: string,
): Promise<ActionResult<GiftCard>> {
  const row = await prisma.gift.findFirst({
    where: { id: giftId, list: { ownerId } },
    select: ownerGiftSelect,
  });
  if (!row) return notFound;

  return { ok: true, data: giftCardSchema.parse(toOwnerGiftCard(row, requestLocale(headers))) };
}

/**
 * Story 5.3 (FR-32, AD-8): the owner marks a wish as received. The transition
 * `OPEN | RESERVED → CLOSED` goes through the only writer of `Gift.status` as a
 * CAS on the status read here: `reserved*`, `quantity` and `visibility` stay,
 * `closedAt` and `closedFromStatus` are written, so the undo can restore exactly
 * the previous status.
 *
 * A foreign or unknown id and an archived wish are told apart (AD-7 keeps the
 * first invisible, AD-8 gives the owner the archived reason), and an already
 * closed wish answers CONFLICT without touching the row.
 */
export async function closeGift(
  headers: Headers,
  giftId: string,
): Promise<ActionResult<GiftCard>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const ownerId = session.user.id;
  const stored = await prisma.gift.findFirst({
    where: { id: giftId, list: { ownerId } },
    select: closeSelect,
  });
  if (!stored) return notFound;
  if (stored.archivedAt !== null) return archivedValidation;
  if (stored.status === "CLOSED" || !canCloseGift(stored)) return alreadyClosed;

  const from = stored.status;
  const now = new Date();
  const outcome = await runGiftStatusTransaction(function closeOwnGift(service) {
    return service.closeGift(giftId, ownerId, from, now);
  });
  if (outcome === "lost") return alreadyClosed;

  return ownerCard(headers, giftId, ownerId);
}

/**
 * Story 5.3 (FR-32, D-43, ARCH-A5): the owner undoes a close inside the
 * `UNDO_WINDOW`. The rules are checked on the row read here (still closed, the
 * window is open, the origin status is known), and the CAS repeats them on the
 * same snapshot: a wish closed again in the meantime carries another `closedAt`
 * and is never reopened by a stale request.
 *
 * `reserved*` are not touched by either transition, so the reservation, its
 * phase, «Купил» and the due date return by themselves.
 */
export async function undoGiftClose(
  headers: Headers,
  giftId: string,
): Promise<ActionResult<GiftCard>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const ownerId = session.user.id;
  const stored = await prisma.gift.findFirst({
    where: { id: giftId, list: { ownerId } },
    select: closeSelect,
  });
  if (!stored) return notFound;
  if (stored.archivedAt !== null) return archivedValidation;
  if (stored.status !== "CLOSED") return undoConflict;

  const closedAt = stored.closedAt;
  const closedFromStatus = stored.closedFromStatus;
  if (closedAt === null || closedFromStatus === null) return undoConflict;

  const now = new Date();
  if (!canUndoClose(stored, now)) return undoWindowExpired;

  const outcome = await runGiftStatusTransaction(function undoOwnClose(service) {
    return service.undoClose(giftId, ownerId, { closedAt, closedFromStatus }, now);
  });
  if (outcome === "lost") return undoConflict;

  return ownerCard(headers, giftId, ownerId);
}
