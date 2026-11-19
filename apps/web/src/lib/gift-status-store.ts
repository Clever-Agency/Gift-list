import "server-only";

import type { Prisma, PrismaClient } from "@/db/generated/client";
import { prisma } from "@/db/client";
import { calendarDay, calendarDayToDate, isBeforeLocalToday } from "@/domain/calendar-day";
import {
  RESERVATION_RELEASE_DATA,
  type GiftStatusTransaction,
} from "@/domain/gift-status";

type GiftDb = Pick<PrismaClient, "gift">;

/**
 * Prisma adapter of `GiftStatusService` (AD-8 / AD-9). This is the only place
 * that writes `Gift.status`, the reservation columns and `archivedAt`.
 *
 * A reservation release receives the caller's transaction, so it commits or
 * rolls back with the field write. Expiry and restore (Story 2.6) are their
 * own CAS writes: the cron has no surrounding transaction, and a past day is
 * refused before the restore write.
 *
 * The CAS on `status: "RESERVED"` means a row that changed status in the
 * meantime is left untouched; `false` says the reservation was already gone.
 */
export function giftStatusTransaction(tx: Prisma.TransactionClient): GiftStatusTransaction {
  return {
    async releaseReservation(giftId) {
      const { count } = await tx.gift.updateMany({
        where: { id: giftId, status: "RESERVED" },
        data: RESERVATION_RELEASE_DATA,
      });
      return count === 1;
    },
    async reserveGift(giftId, data) {
      const { count } = await tx.gift.updateMany({
        where: {
          id: giftId,
          status: "OPEN",
          quantity: "SINGLE",
          archivedAt: null,
        },
        data: {
          status: "RESERVED",
          reservedById: data.reservedById,
          reservedAt: data.reservedAt,
          titleSnapshotOnReserve: data.titleSnapshotOnReserve,
          reservationDueAt: data.reservationDueAt,
          reservationTimeZone: data.reservationTimeZone,
          reservationPhase: "ACTIVE",
          reservationPhaseAt: data.reservationPhaseAt,
          reservationBought: false,
          holderVisibleToOwner: data.holderVisibleToOwner,
          holderVisibleToOthers: data.holderVisibleToOthers,
        },
      });
      return count === 1 ? "success" : "lost";
    },
  };
}

/**
 * Archive `OPEN` wishes whose owner's local date is later than `expiresOn`.
 * `RESERVED` and `CLOSED` are not candidates (Story 6.6). A second run finds
 * nothing left to archive. `count !== 1` is a lost race and is not a success.
 */
export async function processWishExpiry(
  now: Date = new Date(),
  db: GiftDb = prisma,
): Promise<{ archived: number }> {
  const rows = await db.gift.findMany({
    where: { status: "OPEN", archivedAt: null, expiresOn: { not: null } },
    select: {
      id: true,
      expiresOn: true,
      list: { select: { owner: { select: { timeZone: true } } } },
    },
  });

  let archived = 0;
  for (const row of rows) {
    const day = calendarDay(row.expiresOn);
    if (day === null || !isBeforeLocalToday(day, now, row.list.owner.timeZone)) continue;
    const result = await db.gift.updateMany({
      where: { id: row.id, status: "OPEN", archivedAt: null },
      data: { archivedAt: now },
    });
    archived += result.count;
  }
  return { archived };
}

/**
 * Owner puts an archived `OPEN` wish back. The date is replaced in the same
 * update that clears `archivedAt`. A past day is refused before the write.
 */
export async function restoreFromArchive(
  input: {
    giftId: string;
    ownerId: string;
    expiresOn: string | null;
    timeZone: string | null;
    now?: Date;
  },
  db: GiftDb = prisma,
): Promise<"ok" | "missing" | "past"> {
  const now = input.now ?? new Date();
  if (input.expiresOn !== null && isBeforeLocalToday(input.expiresOn, now, input.timeZone)) {
    return "past";
  }

  const result = await db.gift.updateMany({
    where: {
      id: input.giftId,
      status: "OPEN",
      NOT: { archivedAt: null },
      list: { ownerId: input.ownerId },
    },
    data: {
      archivedAt: null,
      expiresOn: input.expiresOn === null ? null : calendarDayToDate(input.expiresOn),
    },
  });
  return result.count === 1 ? "ok" : "missing";
}
