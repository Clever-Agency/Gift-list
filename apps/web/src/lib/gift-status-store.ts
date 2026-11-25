import "server-only";

import type { Prisma, PrismaClient } from "@/db/generated/client";
import { prisma } from "@/db/client";
import { calendarDay, calendarDayToDate, isBeforeLocalToday } from "@/domain/calendar-day";
import {
  EXTENDABLE_RESERVATION_PHASES,
  RESERVATION_GIVER_WINDOW_MS,
  RESERVATION_OWNER_WINDOW_MS,
  RESERVATION_RELEASE_DATA,
  UNDO_WINDOW_MS,
  closeGiftData,
  type GiftStatusEvent,
  type GiftStatusEventKind,
  type GiftStatusTransaction,
  type RecordGiftEvent,
  undoCloseData,
} from "@/domain/gift-status";

import {
  cancelCloseNotification,
  enqueueGiftNotification,
  lockClosureGift,
  notificationGiftSnapshot,
} from "@/lib/notification-store";

type GiftDb = Pick<PrismaClient, "gift">;

/** Story 5.6: the timer reads candidates and runs one transaction per row. */
type ReservationTimerDb = Pick<PrismaClient, "gift" | "$transaction">;

/**
 * Story 5.4: the log name of every event kind. The three transitions of 5.2/5.3
 * keep `gift.status` and the exact line they had, so their tests and any log
 * consumer stay unchanged; the two events of 5.4 get a name of their own.
 *
 * Story 5.6 follows that rule instead of adding a `kind` key to the line: the
 * timer transitions get three names under `gift.reservation.`, so a log query can
 * tell them apart (needed because two of them keep `RESERVED → RESERVED`), and
 * one seam keeps one line shape. The spec's `kind` field belongs to the event
 * payload and reaches the future `Notification` record from there.
 */
const EVENT_NAMES = {
  RESERVATION_RELEASED_BY_HOLDER: "gift.status",
  WISH_CLOSED: "gift.status",
  WISH_REOPENED: "gift.status",
  GIFT_EDITED: "gift.edited",
  GIFT_DELETED: "gift.deleted",
  RESERVATION_GIVER_DEADLINE_PASSED: "gift.reservation.giver-deadline-passed",
  RESERVATION_OWNER_WINDOW_STARTED: "gift.reservation.owner-window-started",
  RESERVATION_RELEASED_BY_EXPIRY: "gift.reservation.released-by-expiry",
} as const satisfies Record<GiftStatusEventKind, string>;

/**
 * The single seam of NFR-6 (Story 5.2/5.3, variant A; extended by 5.4): one
 * structured audit line per successful transition or edit — identifiers and the
 * transition only, without names, nicks, emails or titles (FR-31), so the line is
 * not a leak channel. An edit reports the names of its significant fields and
 * still no values.
 *
 * Notification rows are written within the mutation transaction. The audit
 * remains a separate, post-commit signal.
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
 * Story 5.2 adds the holder's release; Story 5.3 adds the owner's close and its
 * undo. All are CAS writes, so of two simultaneous transitions exactly one
 * succeeds; the one that succeeded reports the transition through `emit`, a lost
 * CAS reports nothing (NFR-6). `emit` only collects the event: the audit line is
 * written after the commit by `runGiftStatusTransaction`, so a rolled back
 * transaction leaves no line.
 * `giftStatusTransaction` defaults to writing the line immediately, but no
 * use-case calls the event methods that way.
 *
 * Story 5.5 adds the holder's extension, «Купил» and the two visibility toggles.
 * They change attributes of a live `RESERVED` row and never its status, so they
 * emit nothing: NFR-6 audits a status transition only, and 5.5 has none.
 *
 * Deletion and edit enqueue from their use-case transactions. Destructive
 * reservation CAS methods capture the instance before clearing its fields.
 */
export function giftStatusTransaction(
  tx: Prisma.TransactionClient,
  emit: RecordGiftEvent = recordGiftEvent,
): GiftStatusTransaction {
  return {
    async releaseReservation(giftId, reservedAt) {
      const { count } = await tx.gift.updateMany({
        where: { id: giftId, status: "RESERVED", ...(reservedAt === undefined ? {} : { reservedAt }) },
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
      if (count !== 1) return "lost";
      // CLE-124: a reservation is a surprise for the wish's owner, so no
      // `RESERVATION_CREATED` row is written for them anymore.
      return "success";
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
      const gift = await notificationGiftSnapshot(tx, giftId);
      if (gift === null) return "lost";
      const { count } = await tx.gift.updateMany({
        where: { id: giftId, status: "RESERVED", reservedAt: gift.reservedAt, reservedById: actorId },
        data: RESERVATION_RELEASE_DATA,
      });
      if (count !== 1) return "lost";
      // CLE-124: the owner is never told that a holder released the reservation.
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
      if (from === "RESERVED") await enqueueGiftNotification(tx, await notificationGiftSnapshot(tx, giftId), {
        kind: "GIFT_CLOSED", role: "holder", email: true, at: at,
      });
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
      const { gift, now } = await lockClosureGift(tx, giftId);
      if (!gift) return "lost";
      const effectiveAt = new Date(Math.max(at.getTime(), now.getTime()));
      if (effectiveAt.getTime() >= expected.closedAt.getTime() + UNDO_WINDOW_MS) return "lost";
      const { count } = await tx.gift.updateMany({
        where: {
          id: giftId,
          status: "CLOSED",
          // Both the snapshot CAS (`equals`) and the undo window (`gt`) ride on
          // one condition: a wish closed again in the meantime carries another
          // `closedAt` and is never reopened by a stale request.
          closedAt: {
            equals: expected.closedAt,
            gt: new Date(effectiveAt.getTime() - UNDO_WINDOW_MS),
          },
          closedFromStatus: expected.closedFromStatus,
          list: { ownerId: actorId },
        },
        data: undoCloseData(expected.closedFromStatus),
      });
      if (count !== 1) return "lost";
      await cancelCloseNotification(tx, giftId, expected.closedAt);
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
    async moveReservationToAwaitingGiver(giftId, at) {
      const { count } = await tx.gift.updateMany({
        where: {
          id: giftId,
          status: "RESERVED",
          archivedAt: null,
          reservationPhase: "ACTIVE",
          reservationDueAt: { lte: at },
        },
        data: { reservationPhase: "AWAITING_GIVER", reservationPhaseAt: at },
      });
      if (count !== 1) return "lost";
      await enqueueGiftNotification(tx, await notificationGiftSnapshot(tx, giftId), {
        kind: "RESERVATION_DUE", role: "holder", email: true, at: at,
      });
      emit({
        giftId,
        actorId: null,
        from: "RESERVED",
        to: "RESERVED",
        at,
        kind: "RESERVATION_GIVER_DEADLINE_PASSED",
      });
      return "success";
    },
    async moveReservationToAwaitingOwner(giftId, at) {
      const { count } = await tx.gift.updateMany({
        where: {
          id: giftId,
          status: "RESERVED",
          archivedAt: null,
          reservationPhase: "AWAITING_GIVER",
          // The window rides in the predicate, not in the caller: a phase moved
          // a second ago (step 1 of this run) is never asked in the same run.
          reservationPhaseAt: {
            lte: new Date(at.getTime() - RESERVATION_GIVER_WINDOW_MS),
          },
        },
        data: { reservationPhase: "AWAITING_OWNER", reservationPhaseAt: at },
      });
      if (count !== 1) return "lost";
      // CLE-124: `AWAITING_OWNER` still happens on the timer, but the owner is
      // never asked about it; no `RESERVATION_OWNER_ASK` row is written and the
      // phase stays internal.
      emit({
        giftId,
        actorId: null,
        from: "RESERVED",
        to: "RESERVED",
        at,
        kind: "RESERVATION_OWNER_WINDOW_STARTED",
      });
      return "success";
    },
    async releaseReservationByExpiry(giftId, at) {
      const gift = await notificationGiftSnapshot(tx, giftId);
      if (gift === null || gift.status !== "RESERVED") return "lost";
      const { count } = await tx.gift.updateMany({
        where: {
          id: giftId,
          status: "RESERVED", reservedAt: gift.reservedAt,
          archivedAt: null,
          reservationPhase: "AWAITING_OWNER",
          // `bought` is part of the CAS: a mark set between the read and the
          // write keeps the gift from being opened by the timer.
          reservationBought: false,
          // CLE-124/D-49: the 168 hours count from the deadline, and the CAS
          // compares the deadline it read, so a holder's extension (a new
          // `dueAt`, phase `ACTIVE`) wins the race and answers `lost`.
          reservationDueAt: {
            equals: gift.reservationDueAt,
            lte: new Date(at.getTime() - RESERVATION_OWNER_WINDOW_MS),
          },
          // One run moves a row one step: a row moved to the phase by step 2 of
          // this run carries `phaseAt = at` and is not released here.
          reservationPhaseAt: { lt: at },
        },
        data: RESERVATION_RELEASE_DATA,
      });
      if (count !== 1) return "lost";
      // CLE-124: only the holder learns about the automatic release.
      await enqueueGiftNotification(tx, gift, { kind: "RESERVATION_AUTO_RELEASE", role: "holder", email: true, at });
      emit({
        giftId,
        actorId: null,
        from: "RESERVED",
        to: "OPEN",
        at,
        kind: "RESERVATION_RELEASED_BY_EXPIRY",
        // A `RESERVED` row always carries a holder; an anomalous row without one
        // still reports the transition, only without a recipient.
        ...(gift.reservedById === null ? {} : { recipientId: gift.reservedById }),
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
  work: (service: GiftStatusTransaction, tx: Prisma.TransactionClient) => Promise<T>,
  db: Pick<PrismaClient, "$transaction"> = prisma,
): Promise<T> {
  const events: GiftStatusEvent[] = [];
  const result = await db.$transaction(function withCollectedEvents(tx) {
    return work(
      giftStatusTransaction(tx, function collect(event) {
        events.push(event);
      }),
      tx,
    );
  });
  for (const event of events) recordGiftEvent(event);
  return result;
}

const EXPIRY_BATCH = 500;
const RESERVATION_TIMERS_BATCH = 500;
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

/** Story 5.6: the counters the cron route reports (only these three reach it). */
export type ReservationTimersResult = {
  readonly expiredToGiver: number;
  readonly toAwaitingOwner: number;
  readonly released: number;
  readonly failed: number;
};

/**
 * Story 5.6 (AD-9, ARCH-A15), CLE-124/D-49: the hourly reservation cycle. Three
 * steps run in the order AD-9 fixes, with one `now` for the whole run:
 *
 * 1. `ACTIVE → AWAITING_GIVER` when `reservationDueAt ≤ now`;
 * 2. `AWAITING_GIVER → AWAITING_OWNER` when `phaseAt ≤ now − 72 ч`;
 * 3. `AWAITING_OWNER → OPEN` when `reservationDueAt ≤ now − 168 ч`,
 *    `bought = false` and `phaseAt < now`.
 *
 * Step 2 is internal: nobody is notified, and the owner never learns that their
 * wish is reserved. Step 3 counts the 168 hours from the deadline, not from the
 * phase, so the owner's phase is only a marker. A row moved by step 1 or 2
 * carries `phaseAt = now`, so it is not a candidate of the next step in the same
 * run: a run moves a row at most one step. Steps are read in batches by `id`, and
 * every row is its own CAS transaction, so one failing row is counted in
 * `failed`, logged by id and error name only (no titles), and does not stop the
 * rest. A lost CAS writes and reports nothing.
 */
export async function processReservationTimers(
  now: Date = new Date(),
  db: ReservationTimerDb = prisma,
): Promise<ReservationTimersResult> {
  const giverDeadline = new Date(now.getTime() - RESERVATION_GIVER_WINDOW_MS);
  const ownerDeadline = new Date(now.getTime() - RESERVATION_OWNER_WINDOW_MS);

  const expired = await runReservationTimerStep(
    db,
    "expiredToGiver",
    {
      status: "RESERVED",
      archivedAt: null,
      reservationPhase: "ACTIVE",
      reservationDueAt: { lte: now },
    },
    function moveToAwaitingGiver(service, giftId) {
      return service.moveReservationToAwaitingGiver(giftId, now);
    },
  );

  const toAwaitingOwner = await runReservationTimerStep(
    db,
    "toAwaitingOwner",
    {
      status: "RESERVED",
      archivedAt: null,
      reservationPhase: "AWAITING_GIVER",
      reservationPhaseAt: { lte: giverDeadline },
    },
    function moveToAwaitingOwner(service, giftId) {
      return service.moveReservationToAwaitingOwner(giftId, now);
    },
  );

  const released = await runReservationTimerStep(
    db,
    "released",
    {
      status: "RESERVED",
      archivedAt: null,
      reservationPhase: "AWAITING_OWNER",
      reservationBought: false,
      reservationDueAt: { lte: ownerDeadline },
      // Step 2 of this same run sets `phaseAt = now`; such a row waits for the
      // next run instead of being released immediately.
      reservationPhaseAt: { lt: now },
    },
    function releaseByExpiry(service, giftId) {
      return service.releaseReservationByExpiry(giftId, now);
    },
  );

  return {
    expiredToGiver: expired.done,
    toAwaitingOwner: toAwaitingOwner.done,
    released: released.done,
    failed: expired.failed + toAwaitingOwner.failed + released.failed,
  };
}

/**
 * One step of {@link processReservationTimers}: candidates in batches of
 * {@link RESERVATION_TIMERS_BATCH} by `id`, each row in its own transaction.
 * The row stays a candidate only if its CAS was lost; the next run picks it up.
 */
async function runReservationTimerStep(
  db: ReservationTimerDb,
  step: "expiredToGiver" | "toAwaitingOwner" | "released",
  where: Prisma.GiftWhereInput,
  write: (
    service: GiftStatusTransaction,
    giftId: string,
  ) => Promise<"success" | "lost">,
): Promise<{ done: number; failed: number }> {
  let done = 0;
  let failed = 0;
  let lastId: string | undefined;
  for (;;) {
    const rows = await db.gift.findMany({
      where: {
        ...where,
        ...(lastId === undefined ? {} : { id: { gt: lastId } }),
      },
      select: { id: true },
      orderBy: { id: "asc" },
      take: RESERVATION_TIMERS_BATCH,
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      try {
        const outcome = await runGiftStatusTransaction(
          function timerCas(service) {
            return write(service, row.id);
          },
          db,
        );
        if (outcome === "success") done += 1;
      } catch (error) {
        failed += 1;
        const reason =
          error instanceof Error
            ? `${error.name}${"code" in error ? ` ${String(error.code)}` : ""}`
            : "unknown";
        console.error(
          `reservation-timers: ${step} of wish ${row.id} failed: ${reason}`,
        );
      }
    }

    if (rows.length < RESERVATION_TIMERS_BATCH) break;
    lastId = rows[rows.length - 1]!.id;
  }
  return { done, failed };
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
