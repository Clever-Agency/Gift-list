import "server-only";

import type { Prisma, PrismaClient } from "@/db/generated/client";
import { prisma } from "@/db/client";
import { calendarDay, calendarDayToDate, isBeforeLocalToday } from "@/domain/calendar-day";
import { RESERVATION_RELEASE_DATA, type GiftStatusEvent, type GiftStatusTransaction } from "@/domain/gift-status";

type GiftDb = Pick<PrismaClient, "gift">;

/**
 * The single seam of NFR-6 (Story 5.2/5.3, variant A): one structured audit line
 * per successful transition — identifiers and the transition only, without
 * names, nicks, emails or titles (FR-31), so the line is not a leak channel.
 *
 * Variant B (a `Notification` row with `deliverAfter` from Epic 6) replaces only
 * this body: the CAS methods, the use-cases and the routes keep calling
 * `recordGiftEvent` and do not change. `kind` and `at` are already in the event
 * for that future record; the log line keeps the format the spec fixes.
 */
export function recordGiftEvent(event: GiftStatusEvent): void {
  console.info(
    JSON.stringify({
      event: "gift.status",
      giftId: event.giftId,
      actorId: event.actorId,
      from: event.from,
      to: event.to,
      at: event.at.toISOString(),
    }),
  );
}

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
 *
 * Story 5.2 adds the holder's and the owner's releases. Both are CAS writes, so
 * of two simultaneous releases exactly one succeeds; the one that succeeded
 * reports the transition to {@link recordGiftEvent}, a lost CAS reports nothing
 * (NFR-6). The audit line is written from inside the transaction, so a rolled
 * back transaction keeps a log line — variant A accepts that: the log is not a
 * source the application reads back.
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
    async releaseReservationByHolder(giftId, actorId, at) {
      const { count } = await tx.gift.updateMany({
        where: { id: giftId, status: "RESERVED", reservedById: actorId },
        data: RESERVATION_RELEASE_DATA,
      });
      if (count !== 1) return "lost";
      recordGiftEvent({
        giftId,
        actorId,
        from: "RESERVED",
        to: "OPEN",
        at,
        kind: "RESERVATION_RELEASED_BY_HOLDER",
      });
      return "success";
    },
    async releaseReservationByOwner(giftId, actorId, at) {
      const { count } = await tx.gift.updateMany({
        where: { id: giftId, status: "RESERVED", list: { ownerId: actorId } },
        data: RESERVATION_RELEASE_DATA,
      });
      if (count !== 1) return "lost";
      recordGiftEvent({
        giftId,
        actorId,
        from: "RESERVED",
        to: "OPEN",
        at,
        kind: "RESERVATION_RELEASED_BY_OWNER",
      });
      return "success";
    },
  };
}

const EXPIRY_BATCH = 500;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Archive `OPEN` wishes whose owner's local date is later than `expiresOn`.
 * `RESERVED` and `CLOSED` are not candidates (Story 6.6). A second run finds
 * nothing left to archive. `count !== 1` is a lost race and is not a success.
 *
 * Candidates are read in batches by `id`. A local day of any zone is at most
 * UTC-today + 1, so a later `expiresOn` can never be due and is not read. The
 * CAS also compares `expiresOn`: an owner who moved the date forward between
 * the read and the write keeps the wish. One failing row is logged (id and error
 * name only, no titles), counted in `failed` and does not stop the rest.
 */
export async function processWishExpiry(
  now: Date = new Date(),
  db: GiftDb = prisma,
): Promise<{ archived: number; failed: number }> {
  const utcToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const horizon = new Date(utcToday.getTime() + DAY_MS);

  let archived = 0;
  let failed = 0;
  let lastId: string | undefined;
  for (;;) {
    const rows = await db.gift.findMany({
      where: {
        status: "OPEN",
        archivedAt: null,
        expiresOn: { not: null, lt: horizon },
        ...(lastId === undefined ? {} : { id: { gt: lastId } }),
      },
      select: {
        id: true,
        expiresOn: true,
        list: { select: { owner: { select: { timeZone: true } } } },
      },
      orderBy: { id: "asc" },
      take: EXPIRY_BATCH,
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      const day = calendarDay(row.expiresOn);
      if (day === null || !isBeforeLocalToday(day, now, row.list.owner.timeZone)) continue;
      try {
        const result = await db.gift.updateMany({
          where: {
            id: row.id,
            status: "OPEN",
            archivedAt: null,
            expiresOn: row.expiresOn,
          },
          data: { archivedAt: now },
        });
        archived += result.count;
      } catch (error) {
        failed += 1;
        const reason =
          error instanceof Error
            ? `${error.name}${"code" in error ? ` ${String(error.code)}` : ""}`
            : "unknown";
        console.error(`wish-expiry: archive of wish ${row.id} failed: ${reason}`);
      }
    }

    if (rows.length < EXPIRY_BATCH) break;
    lastId = rows[rows.length - 1]!.id;
  }
  return { archived, failed };
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
