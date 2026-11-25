import "server-only";

import type { ActionResult, NotificationAction } from "@gift-list/contracts";
import { auth } from "@/lib/auth";
import { isDueOnInRange, reservationDueAtFromDueOn } from "@/domain/reservation-due";
import { runGiftStatusTransaction } from "@/lib/gift-status-store";
import { notificationGiftSnapshot, notificationIsActionable, isHiddenOwnerReservationNotification } from "@/lib/notification-store";
import { canonicalTimeZone } from "@/lib/time-zone";

export const NOTIFICATION_NOT_FOUND = {
  ok: false, code: "NOT_FOUND", message: "Notification not found",
} as const;
export const NOTIFICATION_AUTH_REQUIRED = {
  ok: false, code: "UNAUTHENTICATED", message: "Authentication required",
} as const;

const stale = { ok: false, code: "CONFLICT", message: "The reservation request is no longer current" } as const;
const invalidDate = { ok: false, code: "VALIDATION", reason: "DUE_OUT_OF_RANGE", message: "Invalid reservation date" } as const;

export async function notificationUserId(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user.id ?? null;
}

export async function actOnNotification(
  userId: string, id: string, command: NotificationAction,
): Promise<ActionResult<{ id: string }>> {
  return runGiftStatusTransaction(async function apply(service, tx) {
    const now = new Date();
    const row = await tx.notification.findFirst({
      where: { id, recipientId: userId, deliverAfter: { lte: now } },
    });
    if (!row?.giftId) return NOTIFICATION_NOT_FOUND;
    // CLE-124: a row the owner must not see behaves as if it never existed, so
    // an old «Подарок уже у вас?» link cannot act on the reservation.
    if (isHiddenOwnerReservationNotification(row)) return NOTIFICATION_NOT_FOUND;

    // Hold the gift row through the action CAS so the checked reservation and
    // phase cannot be replaced by another request between the check and write.
    await tx.$queryRaw`SELECT id FROM "Gift" WHERE id = ${row.giftId} FOR UPDATE`;
    const gift = await notificationGiftSnapshot(tx, row.giftId);
    if (!gift || !notificationIsActionable(row, gift)) return stale;

    const giftId = row.giftId;
    let outcome: "success" | "lost";
    // D-49 (CLE-124): the owner never gets an actionable row about somebody
    // else's reservation, so the owner's «Получил» / «Оставить бронь» / «Снять
    // бронь» actions no longer exist here. `RESERVATION_OWNER_ASK` rows are hidden
    // above and an old link answers NOTIFICATION_NOT_FOUND. The holder's own
    // actions (RESERVATION_DUE) are unchanged.
    if (row.kind === "RESERVATION_DUE") {
      if (command.action === "extend") {
        const holder = await tx.user.findUnique({ where: { id: userId }, select: { timeZone: true } });
        const timeZone = canonicalTimeZone(holder?.timeZone ?? null);
        if (!isDueOnInRange(command.dueOn, timeZone, now)) return invalidDate;
        const dueAt = reservationDueAtFromDueOn(command.dueOn, timeZone);
        outcome = await service.extendReservation(giftId, userId, { dueAt, timeZone, at: now });
      } else if (command.action === "bought" || command.action === "clearBought") {
        outcome = await service.setReservationBought(giftId, userId, { value: command.action === "bought" });
      } else if (command.action === "release") {
        outcome = await service.releaseReservationByHolder(giftId, userId, now);
      } else {
        return stale;
      }
    } else {
      return stale;
    }
    if (outcome === "lost") return stale;
    await tx.notification.updateMany({ where: { id, recipientId: userId, readAt: null }, data: { readAt: now } });
    return { ok: true, data: { id } };
  });
}
