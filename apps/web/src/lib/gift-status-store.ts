import "server-only";

import type { Prisma, PrismaClient } from "@/db/generated/client";
import { prisma } from "@/db/client";
import { calendarDay, calendarDayToDate, isBeforeLocalToday } from "@/domain/calendar-day";
import {
  EXTENDABLE_RESERVATION_PHASES,
  RESERVATION_RELEASE_DATA,
  UNDO_WINDOW_MS,
  closeGiftData,
  type GiftStatusEvent,
  type GiftStatusEventKind,
  type GiftStatusTransaction,
  type RecordGiftEvent,
  undoCloseData,
} from "@/domain/gift-status";

type GiftDb = Pick<PrismaClient, "gift">;

/**
 * Story 5.4: the log name of every event kind. The four transitions of 5.2/5.3
 * keep `gift.status` and the exact line they had, so their tests and any log
 * consumer stay unchanged; the two events of 5.4 get a name of their own.
 */
const EVENT_NAMES = {
  RESERVATION_RELEASED_BY_HOLDER: "gift.status",
  RESERVATION_RELEASED_BY_OWNER: "gift.status",
  WISH_CLOSED: "gift.status",
  WISH_REOPENED: "gift.status",
  GIFT_EDITED: "gift.edited",
  GIFT_DELETED: "gift.deleted",
} as const satisfies Record<GiftStatusEventKind, string>;

/**
 * The single seam of NFR-6 (Story 5.2/5.3, variant A; extended by 5.4): one
 * structured audit line per successful transition or edit — identifiers and the
 * transition only, without names, nicks, emails or titles (FR-31), so the line is
 * not a leak channel. An edit reports the names of its significant fields and
 * still no values.
 *
 * Variant B (a `Notification` row with `deliverAfter` from Epic 6) replaces only
 * this body: the CAS methods, the use-cases and the routes keep calling
 * `recordGiftEvent` and do not change. `kind` and `at` are already in the event
 * for that future record; the log line keeps the format the spec fixes, and the
 * keys an event does not carry (`from`/`to`, `fields`, `recipientId`) are
 * omitted rather than written as `null`, so lines of the first four kinds stay
 * byte-for-byte what they were.
 */
export function recordGiftEvent(event: GiftStatusEvent): void {
  console.info(
    JSON.stringify({
      event: EVENT_NAMES[event.kind],
      giftId: event.giftId,
      actorId: event.actorId,
      ...(event.from === undefined ? {} : { from: event.from }),
      ...(event.to === undefined ? {} : { to: event.to }),
      ...(event.fields === undefined ? {} : { fields: event.fields }),
      ...(event.recipientId === undefined ? {} : { recipientId: event.recipientId }),
      at: event.at.toISOString(),
    }),
  );
}

/**
 * Prisma adapter of `GiftStatusService` (AD-8 / AD-9). This is the only place
 * that writes `Gift.status`, the reservation columns, the closure columns and
 * `archivedAt`.
 *
 * A reservation release receives the caller's transaction, so it commits or
 * rolls back with the field write. Expiry and restore (Story 2.6) are their
 * own CAS writes: the cron has no surrounding transaction, and a past day is
 * refused before the restore write.
 *
 * The CAS on `status: "RESERVED"` means a row that changed status in the
 * meantime is left untouched; `false` says the reservation was already gone.
 *
 * Story 5.2 adds the holder's and the owner's releases; Story 5.3 adds the
 * owner's close and its undo. All are CAS writes, so of two simultaneous
 * transitions exactly one succeeds; the one that succeeded reports the
 * transition through `emit`, a lost CAS reports nothing (NFR-6). `emit` only
 * collects the event: the audit line is written after the commit by
 * `runGiftStatusTransaction`, so a rolled back transaction leaves no line.
 * `giftStatusTransaction` defaults to writing the line immediately, but no
 * use-case calls the event methods that way.
 *
 * Story 5.5 adds the holder's extension, «Купил» and the two visibility toggles.
 * They change attributes of a live `RESERVED` row and never its status, so they
 * emit nothing: NFR-6 audits a status transition only, and 5.5 has none.
 *
 * Story 5.4 deletes a wish in the use-case's own transaction and reports its two
 * events there, after the commit: the deletion takes the reservation off through
 * `releaseReservation`, which stays silent on purpose (a release that is part of
 * a deletion is not a separate «owner released the reservation»), and an edit
 * has no CAS method here at all.
 */
export function giftStatusTransaction(
  tx: Prisma.TransactionClient,
  emit: RecordGiftEvent = recordGiftEvent,
): GiftStatusTransaction {
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
    async extendReservation(giftId, actorId, write) {
      const { count } = await tx.gift.updateMany({
        where: {
          id: giftId,
          status: "RESERVED",
          reservedById: actorId,
          // The same phase list as `canExtendReservation`, so `GIVEN` is refused
          // here even when a stale pre-check let the request through.
          reservationPhase: { in: [...EXTENDABLE_RESERVATION_PHASES] },
        },
        data: {
          reservationDueAt: write.dueAt,
          reservationTimeZone: write.timeZone,
          reservationPhase: "ACTIVE",
          reservationPhaseAt: write.at,
        },
      });
      return count === 1 ? "success" : "lost";
    },
    async setReservationBought(giftId, actorId, write) {
      const { count } = await tx.gift.updateMany({
        where: { id: giftId, status: "RESERVED", reservedById: actorId },
        data: { reservationBought: write.value },
      });
      return count === 1 ? "success" : "lost";
    },
    async setReservationVisibility(giftId, actorId, write) {
      const { count } = await tx.gift.updateMany({
        where: { id: giftId, status: "RESERVED", reservedById: actorId },
        data: {
          holderVisibleToOwner: write.holderVisibleToOwner,
          holderVisibleToOthers: write.holderVisibleToOthers,
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
      emit({
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
      emit({
        giftId,
        actorId,
        from: "RESERVED",
        to: "OPEN",
        at,
        kind: "RESERVATION_RELEASED_BY_OWNER",
      });
      return "success";
    },
    async closeGift(giftId, actorId, from, at) {
      const { count } = await tx.gift.updateMany({
        where: {
          id: giftId,
          status: from,
          archivedAt: null,
          list: { ownerId: actorId },
        },
        data: closeGiftData(from, at),
      });
      if (count !== 1) return "lost";
      emit({
        giftId,
        actorId,
        from,
        to: "CLOSED",
        at,
        kind: "WISH_CLOSED",
      });
      return "success";
    },
    async undoClose(giftId, actorId, expected, at) {
      const { count } = await tx.gift.updateMany({
        where: {
          id: giftId,
          status: "CLOSED",
          // Both the snapshot CAS (`equals`) and the undo window (`gt`) ride on
          // one condition: a wish closed again in the meantime carries another
          // `closedAt` and is never reopened by a stale request.
          closedAt: {
            equals: expected.closedAt,
            gt: new Date(at.getTime() - UNDO_WINDOW_MS),
          },
          closedFromStatus: expected.closedFromStatus,
          list: { ownerId: actorId },
        },
        data: undoCloseData(expected.closedFromStatus),
      });
      if (count !== 1) return "lost";
      emit({
        giftId,
        actorId,
        from: "CLOSED",
        to: expected.closedFromStatus,
        at,
        kind: "WISH_REOPENED",
      });
      return "success";
    },
  };
}

/**
 * Runs one `GiftStatusService` write in a transaction and reports its
 * transition **after** the commit (NFR-6): the CAS methods only collect events,
 * so a transaction that rolls back leaves no audit line about a write that
 * never happened. Every use-case of 5.2 and 5.3 goes through this helper.
 */
export async function runGiftStatusTransaction<T>(
  work: (service: GiftStatusTransaction) => Promise<T>,
  db: Pick<PrismaClient, "$transaction"> = prisma,
): Promise<T> {
  const events: GiftStatusEvent[] = [];
  const result = await db.$transaction(function withCollectedEvents(tx) {
    return work(
      giftStatusTransaction(tx, function collect(event) {
        events.push(event);
      }),
    );
  });
  for (const event of events) recordGiftEvent(event);
  return result;
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
