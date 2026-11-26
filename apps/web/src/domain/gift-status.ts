// AD-8 / AD-9 — `GiftStatusService`. Rules only: no Prisma, no React/Next.js
// here (AD-1). The Prisma adapter in `lib/gift-status-store.ts` owns the write.
//
// CLE-82/S23.2: the owner's `RESERVED → OPEN` release, including the silent
// release when a narrowed visibility takes the holder's access away.
// Story 2.6: archiving an expired open wish and restoring it are writes in that
// same adapter. Whether a day is already past is `isBeforeLocalToday`.
// Story 5.6: the reservation timers of AD-9 (72 and 168 hours). The rules are
// pure; the CAS writes live in the same adapter. CLE-124/D-49: the owner has no
// answer to give — `AWAITING_OWNER` is an internal phase, and the release is
// counted from `reservationDueAt`, not from the phase moment. CLE-124/S9b-1:
// neither `bought` nor `GIVEN` protects a reservation from the timer — a holder
// cannot keep a wish blocked forever by marking it or promising it.
// Story 6.6: the wish-expiry cron clears an expired reservation and archives the
// wish in one write unless the holder marked the gift as bought, and reminds the
// holder three days before the date. Both live in the adapter, next to the timer
// releases.

import { RESERVATION_PHASES } from "@gift-list/contracts";
import type { GiftEditEventField } from "./gift-edit";
import {
  VisibilityPolicy,
  type GiftVisibility,
  type ViewerRelations,
} from "./visibility";

/**
 * The columns a `RESERVED → OPEN` transition writes (AD-9): `status` becomes
 * `OPEN`, and every reservation column is cleared. `closedAt` and
 * `closedFromStatus` are not touched: closing keeps `reserved*` for audit and is
 * a different transition, so this release never rewrites closure data.
 */
export const RESERVATION_RELEASE_DATA = {
  status: "OPEN",
  reservedById: null,
  reservedAt: null,
  reservationDueAt: null,
  reservationTimeZone: null,
  reservationPhase: null,
  reservationPhaseAt: null,
  reservationBought: false,
  holderVisibleToOwner: false,
  holderVisibleToOthers: true,
  titleSnapshotOnReserve: null,
} as const;

/** The gift fields this slice of the service reads. */
export type GiftStatusRow = {
  readonly status: "OPEN" | "RESERVED" | "CLOSED";
};

export type ReserveEligibleRow = GiftStatusRow & {
  readonly quantity: "SINGLE" | "UNLIMITED";
  readonly archivedAt: Date | null;
};

export type ReserveGiftWrite = {
  readonly reservedById: string;
  readonly reservedAt: Date;
  readonly titleSnapshotOnReserve: string;
  readonly reservationDueAt: Date;
  readonly reservationTimeZone: string;
  readonly reservationPhaseAt: Date;
  readonly holderVisibleToOthers: boolean;
};

/** The closed reservation phases (Story 5.5); the wire enum is `RESERVATION_PHASES`. */
export type ReservationPhase = (typeof RESERVATION_PHASES)[number];

/**
 * Story 5.5 (AD-9): one extension of a live reservation. `dueAt` is the exclusive
 * end of the new chosen day, `timeZone` a fresh snapshot of the holder's zone
 * (`canonicalTimeZone(storedTimeZone(...))`, as in Story 5.1) and `at` the moment
 * the phase returns to `ACTIVE`. `bought` is deliberately not part of the write:
 * extending never changes it.
 */
export type ExtendReservationWrite = {
  readonly dueAt: Date;
  readonly timeZone: string;
  readonly at: Date;
};

/** Story 5.5: only `Gift.reservationBought` changes. */
export type SetReservationBoughtWrite = {
  readonly value: boolean;
};

/** Story 5.5: the holder's guest-visibility switch. CLE-124/D-49: the owner toggle is always `false`. */
export type SetReservationVisibilityWrite = {
  readonly holderVisibleToOthers: boolean;
};

/**
 * Story 5.5, CLE-124/S9b-2: the only phase an extension may leave. The deadline
 * itself must also be in the future (`canExtendReservation` reads it), because a
 * passed deadline forbids any extension. `GIVEN` and the internal `AWAITING_*`
 * phases are refused on purpose: the first is the holder's promise, the others
 * only exist after the deadline, and an extension would silently restart the
 * cycle. The store's CAS uses this exact list plus `reservationDueAt > at`, so
 * the pre-check and the write cannot drift apart.
 */
export const EXTENDABLE_RESERVATION_PHASES = ["ACTIVE"] as const satisfies readonly ReservationPhase[];

/**
 * CLE-124/S9b-2 (Story 5.7): the phases «Подарил» may be pressed from. A live
 * reservation of the actor in any of these moves to `GIVEN`; `GIVEN` itself is
 * not listed, because a repeated press is answered as an idempotent success
 * without a second write or e-mail.
 */
export const GIVABLE_RESERVATION_PHASES = [
  "ACTIVE",
  "AWAITING_GIVER",
  "AWAITING_OWNER",
] as const satisfies readonly ReservationPhase[];


/**
 * CLE-124/S9b-1: the phases the timer releases from. `AWAITING_OWNER` is the
 * ordinary end of the cycle, `GIVEN` is the holder's «Подарил» promise — and the
 * promise does not protect the reservation either: after 168 hours past
 * `reservationDueAt` both are released, so a wish cannot stay blocked forever.
 */
export const RELEASABLE_RESERVATION_PHASES = [
  "AWAITING_OWNER",
  "GIVEN",
] as const satisfies readonly ReservationPhase[];

/** Only a live reservation is released; an OPEN or CLOSED row has nothing to clear. */
export function hasActiveReservation(row: GiftStatusRow): boolean {
  return row.status === "RESERVED";
}

/** The columns the owner's release preflight reads (Story 5.2). */
export type ReservationWarningRow = {
  readonly status: GiftStatusRow["status"];
  readonly reservationBought: boolean;
};

/**
 * Story 5.2 (FR-31, AD-12): the owner's answer before releasing someone else's
 * reservation. `BOUGHT` says the holder marked the gift as bought, so releasing
 * it lets somebody else buy it again. The `GIVEN` branch belongs to Story 5.7 —
 * no row carries that phase yet — so this slice answers `BOUGHT` or `null` only.
 *
 * A wish that is no longer `RESERVED` warns about nothing: the preflight only
 * reads and never argues with a stale state, the `DELETE` decides.
 */
export function reservationWarning(row: ReservationWarningRow): "BOUGHT" | null {
  if (row.status !== "RESERVED") return null;
  return row.reservationBought ? "BOUGHT" : null;
}

/**
 * Story 5.3 (D-43, ARCH-A5): the one undo window of a close. The server checks
 * it on every undo, so a client clock can never widen it; the client only counts
 * down to the `undoUntil` moment the response carries.
 */
export const UNDO_WINDOW_MS = 10 * 60 * 1000;

/** A wish closes from `OPEN` or `RESERVED`; that is the status the undo restores. */
export type ClosedFromStatus = "OPEN" | "RESERVED";

/** The columns the closing rules read (AD-8: an archived wish is read-only). */
export type CloseGiftRow = {
  readonly status: GiftStatusRow["status"];
  readonly archivedAt: Date | null;
};

/**
 * Story 5.3 (FR-32, AD-8): the owner closes a wish that is still `OPEN` or
 * `RESERVED` and not archived. An archived wish is read-only, and a `CLOSED` one
 * is not closed twice (the use-case answers CONFLICT before this predicate).
 */
export function canCloseGift(row: CloseGiftRow): boolean {
  return row.archivedAt === null && row.status !== "CLOSED";
}

/** The columns a close writes; `reserved*`, `quantity` and `visibility` stay. */
export type CloseGiftData = {
  readonly status: "CLOSED";
  readonly closedAt: Date;
  readonly closedFromStatus: ClosedFromStatus;
};

/**
 * Story 5.3 (AD-8): closing keeps the reservation snapshot for audit and only
 * records the status it came from, so an undo can restore exactly that status.
 */
export function closeGiftData(from: ClosedFromStatus, at: Date): CloseGiftData {
  return { status: "CLOSED", closedAt: at, closedFromStatus: from };
}

/** The closure columns the undo rules read. */
export type ClosedGiftRow = {
  readonly status: GiftStatusRow["status"];
  readonly closedAt: Date | null;
  readonly closedFromStatus: ClosedFromStatus | null;
};

/**
 * Story 5.3 (D-43, ARCH-A5): the undo is possible only while
 * `now < closedAt + UNDO_WINDOW_MS` — at exactly ten minutes it is already too
 * late — and only for a closed wish that still knows what it was closed from.
 */
export function canUndoClose(row: ClosedGiftRow, now: Date): boolean {
  if (row.status !== "CLOSED") return false;
  if (row.closedAt === null || row.closedFromStatus === null) return false;
  return now.getTime() < row.closedAt.getTime() + UNDO_WINDOW_MS;
}

/**
 * The columns an undo writes: the status the wish was closed from, and both
 * closure columns cleared. `reserved*` are untouched, so the reservation, its
 * phase, `bought` and the due date come back by themselves.
 */
export function undoCloseData(from: ClosedFromStatus): {
  readonly status: ClosedFromStatus;
  readonly closedAt: null;
  readonly closedFromStatus: null;
} {
  return { status: from, closedAt: null, closedFromStatus: null };
}

/**
 * The moment the owner's card carries as `undoUntil`: `closedAt + UNDO_WINDOW_MS`
 * for a `CLOSED` wish — even when it is already in the past, so the client can
 * order the closed section — and `null` for every other status.
 */
export function undoUntil(row: {
  readonly status: GiftStatusRow["status"];
  readonly closedAt: Date | null;
}): Date | null {
  if (row.status !== "CLOSED" || row.closedAt === null) return null;
  return new Date(row.closedAt.getTime() + UNDO_WINDOW_MS);
}

/**
 * Story 5.2/5.3/5.4/5.6 (NFR-6): the transitions and edits the one seam reports.
 * The list is shared, so no two stories can write the same event differently.
 *
 * The first four are status transitions (5.2/5.3). `GIFT_EDITED` is not a
 * transition: an owner's edit of a reserved wish never changes its status, so it
 * carries `fields` and no `from`/`to`. `GIFT_DELETED` is the transition that the
 * release performed by the delete really made (`RESERVED → OPEN`), because the
 * model has no "deleted" status.
 *
 * Story 5.6 reports the reservation cycle: all its transitions keep
 * `RESERVED → RESERVED` except the expiry release, so the `kind` is what tells
 * the phase moves apart. CLE-124/D-49 removes the owner's release and keep:
 * the owner never takes part in a reservation of their own wish.
 *
 * Story 6.6 adds one transition: an expired reservation is cleared and the wish
 * archived in one write (`WISH_EXPIRED_AND_ARCHIVED`, `RESERVED → OPEN`).
 */
export type GiftStatusEventKind =
  | "RESERVATION_RELEASED_BY_HOLDER"
  | "WISH_CLOSED"
  | "WISH_REOPENED"
  | "GIFT_EDITED"
  | "GIFT_DELETED"
  | "RESERVATION_GIVER_DEADLINE_PASSED"
  | "RESERVATION_OWNER_WINDOW_STARTED"
  | "RESERVATION_RELEASED_BY_EXPIRY"
  | "WISH_EXPIRED_AND_ARCHIVED";

/**
 * The payload of {@link RecordGiftEvent}: identifiers and the transition only —
 * no names, nicks, emails or titles (FR-31).
 *
 * Story 5.4: `from`/`to` are optional because an edit has no transition.
 * `fields` belongs to `GIFT_EDITED` and holds names from the closed set
 * {@link GiftEditEventField}, never values. `recipientId` names the person the
 * transition is about: the holder released by `GIFT_DELETED` (the row is gone by
 * then, so this is the only place the future notification can learn it) and the
 * holder released by `RESERVATION_RELEASED_BY_EXPIRY` (Story 5.6).
 *
 * Story 5.6: `actorId` is `null` for the timer transitions — cron is not a person
 * and a made-up `"system"` actor would blur the difference; the field is widened
 * to `string | null` rather than sentinel-filled.
 */
export type GiftStatusEvent = {
  readonly giftId: string;
  readonly actorId: string | null;
  readonly from?: GiftStatusRow["status"];
  readonly to?: GiftStatusRow["status"];
  readonly fields?: readonly GiftEditEventField[];
  readonly recipientId?: string;
  readonly at: Date;
  readonly kind: GiftStatusEventKind;
};

/**
 * The NFR-6 audit seam reports successful transitions after commit.
 * Notifications are created inside the mutation transaction.
 *
 * The store reports a transition only after the surrounding transaction has
 * committed (`runGiftStatusTransaction`), so a rolled back write leaves no line
 * about a transition that never happened.
 */
export type RecordGiftEvent = (event: GiftStatusEvent) => void;

/** The snapshot an undo is decided on (Story 5.3); a mismatch is a lost CAS. */
export type UndoCloseSnapshot = {
  readonly closedAt: Date;
  readonly closedFromStatus: ClosedFromStatus;
};

/**
 * Story 6.6 (FR-42, D-26): the three answers of the wish-expiry write of one
 * expired `RESERVED` wish. `released` — the reservation was cleared and the wish
 * archived in one write; `notified` — the gift is marked as bought, so the
 * status and the reservation stay and only the holder's notice was queued;
 * `lost` — nothing was written (lost race, moved date, closed or archived wish,
 * or a repeated run whose notice already exists).
 */
export type WishExpiryOutcome = "released" | "notified" | "lost";

/**
 * One `RESERVED → OPEN` write (AD-9). The adapter implements it with Prisma; the
 * caller supplies the transaction so the release shares it with the field write,
 * which keeps a failed visibility update from releasing the reservation.
 */
export interface GiftStatusTransaction {
  /**
   * Clears the reservation columns of a `RESERVED` row (AD-9). Touching a row
   * that is no longer `RESERVED` writes nothing and answers `false`.
   */
  releaseReservation(giftId: string, reservedAt?: Date | null): Promise<boolean>;
  /**
   * Story 5.1: CAS `OPEN → RESERVED` for a single, non-archived wish. A row that
   * no longer matches the predicate is left untouched and answers `lost`.
   */
  reserveGift(giftId: string, data: ReserveGiftWrite): Promise<"success" | "lost">;
  /**
   * Story 5.5 (AD-9): CAS on a live reservation of the holder in an extendable
   * phase. The write moves the deadline, snapshots the zone and puts the phase
   * back to `ACTIVE`. A row that is no longer `RESERVED`, belongs to somebody
   * else or already sits in `GIVEN` is left untouched and answers `lost`.
   */
  extendReservation(
    giftId: string,
    actorId: string,
    write: ExtendReservationWrite,
  ): Promise<"success" | "lost">;
  /**
   * CLE-124/S9b-2 (Story 5.7): CAS `RESERVED` in one of
   * {@link GIVABLE_RESERVATION_PHASES} of the actor → `GIVEN`, with the moment
   * of the press. The wish status, the deadline and `bought` stay untouched. A
   * repeated press in `GIVEN` answers `success` without a second write or the
   * owner's general e-mail — the promise is not told twice.
   */
  markReservationGiven(
    giftId: string,
    actorId: string,
    at: Date,
  ): Promise<"success" | "lost">;
  /**
   * CLE-124/S9b-2 (Story 5.6): the holder's reminder 1–2 days before the
   * deadline. Not a transition: nothing is written, only one in-app + e-mail
   * row is queued, deduplicated by `kind + gift + dueAt`, so a repeated cron
   * run and a holder's extension (a new deadline) behave as the story requires.
   * The owner never receives it.
   */
  remindReservationDue(giftId: string, at: Date): Promise<"success" | "lost">;
  /**
   * Story 6.6 (FR-42, D-26): the holder's «срок желания через 3 дня» notice. Not
   * a transition: the status and every reservation column stay. The row is read
   * inside the caller's transaction and only answers `success` when the notice
   * was really inserted: the spot must still be the live reservation with the
   * same `expiresOn`, not archived, and `at` must be the holder's local
   * `expiresOn − 3` at or after 10:00 in their `User.timeZone`. A repeated run
   * (or a run on a later day) writes nothing, because `skipDuplicates` keeps one
   * row per reservation instance and expiry day. Only the holder is addressed
   * (D-49).
   */
  remindWishExpirySoon(
    giftId: string,
    expectedExpiresOn: Date,
    at: Date,
  ): Promise<"success" | "lost">;
  /**
   * Story 5.5 (AD-9): CAS on any live reservation of the holder. Only
   * `reservationBought` changes, so clearing the mark in `AWAITING_OWNER` keeps
   * `reservationPhaseAt` and the request to the owner stays as it was.
   */
  setReservationBought(
    giftId: string,
    actorId: string,
    write: SetReservationBoughtWrite,
  ): Promise<"success" | "lost">;
  /**
   * Story 5.5 (FR-31): CAS on any live reservation of the holder. Only the two
   * toggles change; the phase, its moment, the deadline and `bought` stay.
   */
  setReservationVisibility(
    giftId: string,
    actorId: string,
    write: SetReservationVisibilityWrite,
  ): Promise<"success" | "lost">;
  /**
   * Story 5.2: CAS `RESERVED → OPEN` for the holder of the reservation. The
   * predicate carries `reservedById`, so a wish held by someone else, released
   * in the meantime or not reserved at all is left untouched and answers `lost`.
   * Visibility is deliberately not part of the predicate: after an unfriend or a
   * block the holder keeps control of the reservation (A-14, FR-25).
   */
  releaseReservationByHolder(
    giftId: string,
    actorId: string,
    at: Date,
  ): Promise<"success" | "lost">;
  /**
   * Story 5.3: CAS `from → CLOSED` for the owner of the list. `from` is the
   * status read in the same use-case, so a wish that moved in between is left
   * untouched and answers `lost`. The write keeps `reserved*` and records
   * `closedAt` and `closedFromStatus`.
   */
  closeGift(
    giftId: string,
    actorId: string,
    from: ClosedFromStatus,
    at: Date,
  ): Promise<"success" | "lost">;
  /**
   * Story 5.3: CAS `CLOSED → closedFromStatus` for the owner, only while the
   * undo window is open and only on the closure snapshot the use-case read. A
   * closed-again wish (a different `closedAt`) or one closed from a different
   * status is left untouched and answers `lost`.
   */
  undoClose(
    giftId: string,
    actorId: string,
    expected: UndoCloseSnapshot,
    at: Date,
  ): Promise<"success" | "lost">;
  /**
   * Story 5.6 (AD-9): CAS `ACTIVE → AWAITING_GIVER` of a live, non-archived
   * reservation whose deadline passed. The timer, not a person, reports the
   * transition, so the event carries `actorId: null`.
   */
  moveReservationToAwaitingGiver(giftId: string, at: Date): Promise<"success" | "lost">;
  /**
   * Story 5.6 (AD-9): CAS `AWAITING_GIVER → AWAITING_OWNER` once the 72-hour
   * window since `reservationPhaseAt` has passed. A row moved by step 1 carries
   * `phaseAt = at`, so it cannot move twice in one run.
   */
  moveReservationToAwaitingOwner(giftId: string, at: Date): Promise<"success" | "lost">;
  /**
   * Story 5.6 (AD-9), CLE-124/D-49/S9b-1: CAS `RESERVED` in one of
   * {@link RELEASABLE_RESERVATION_PHASES} → `OPEN` once the deadline itself is
   * at least 168 hours old. Neither `bought` nor the `GIVEN` phase protects the
   * reservation: a holder who marked the gift as bought or promised it still
   * loses it after the window, so no wish stays blocked forever. A row moved to
   * the phase by step 2 of the same run carries `phaseAt = at` and is not
   * released in that run. The write is the same `RESERVATION_RELEASE_DATA` the
   * 5.2 release uses.
   */
  releaseReservationByExpiry(giftId: string, at: Date): Promise<"success" | "lost">;
  /**
   * Story 6.6 (FR-42, D-26): one expired `RESERVED` wish of the wish-expiry
   * cron. `bought=false`: CAS `RESERVED → OPEN` with `archivedAt = at` in one
   * write; the predicate compares the reservation instance, `expiresOn`,
   * `archivedAt` and `bought=false`, so a holder's release or «Купил», an
   * owner's close or a moved date in between wins the race and answers `lost`.
   * `bought=true`: nothing changes — only one `WISH_EXPIRY` (variant
   * `released: false`) is queued, deduplicated by the reservation instance and
   * the expiry day, so a repeated run answers `lost` and writes nothing.
   * Whatever the variant, only the holder is a recipient (D-49).
   */
  expireReservedWish(giftId: string, at: Date): Promise<WishExpiryOutcome>;
}

/** Only a single open wish can be reserved; unlimited gifts are rejected upstream. */
export function canReserveGift(row: ReserveEligibleRow): boolean {
  return (
    row.status === "OPEN" &&
    row.quantity === "SINGLE" &&
    row.archivedAt === null
  );
}

/** The columns the Story 5.5 predicates read. */
export type ReservationAttributeRow = {
  readonly status: GiftStatusRow["status"];
  readonly reservationPhase: ReservationPhase | null;
};

/** CLE-124/S9b-2: an extension also reads the deadline it must not pass. */
export type ReservationExtendRow = ReservationAttributeRow & {
  readonly reservationDueAt: Date | null;
};

/**
 * Story 5.5, CLE-124/S9b-2: may this reservation be extended? Only a live
 * `RESERVED` row in `ACTIVE` whose `reservationDueAt` is still in the future —
 * once the deadline has passed, extending is forbidden and the reservation
 * waits for its release 168 hours later. `now == dueAt` is already too late: the
 * timer's step 1 moves the row at exactly that moment. The server re-checks the
 * same rule in the CAS, so a stale answer can only lose the race, never write.
 */
export function canExtendReservation(row: ReservationExtendRow, now: Date): boolean {
  if (row.status !== "RESERVED" || row.reservationPhase === null) return false;
  if (!(EXTENDABLE_RESERVATION_PHASES as readonly ReservationPhase[]).includes(row.reservationPhase)) {
    return false;
  }
  return row.reservationDueAt !== null && row.reservationDueAt.getTime() > now.getTime();
}

/**
 * CLE-124/S9b-2 (Story 5.7): may the holder mark the reservation as given? Any
 * live `RESERVED` row of the actor, whatever its phase. `GIVEN` is omitted here
 * on purpose: the store answers a repeated press as an idempotent success.
 */
export function canMarkReservationGiven(row: ReservationAttributeRow): boolean {
  if (row.status !== "RESERVED" || row.reservationPhase === null) return false;
  return (GIVABLE_RESERVATION_PHASES as readonly ReservationPhase[]).includes(
    row.reservationPhase,
  );
}

/**
 * Story 5.5 (AD-9): `bought` and the guests' visibility switch are attributes of any
 * live reservation — every phase, `GIVEN` included, may change them. Only the
 * status limits them; an `OPEN` or `CLOSED` row is not a reservation anymore.
 */
export function canSetReservationAttributes(row: GiftStatusRow): boolean {
  return row.status === "RESERVED";
}

/**
 * Story 5.6 (AD-9), CLE-124/D-49: the two windows of the reservation cycle.
 * After `reservationDueAt` has passed, the giver has 72 hours (from the run that
 * noticed the deadline) before the wish enters the internal `AWAITING_OWNER`
 * phase; 168 hours after `reservationDueAt` itself the reservation is released,
 * whatever phase it is in and whether or not the holder marked «Купил». The
 * release window is counted from the deadline (FR-29), never from
 * `reservationPhaseAt`, so the internal phase is only a marker and a skipped run
 * cannot restart the release window.
 */
export const RESERVATION_GIVER_WINDOW_MS = 72 * 60 * 60 * 1000;
export const RESERVATION_OWNER_WINDOW_MS = 168 * 60 * 60 * 1000;

/**
 * CLE-124/S9b-2 (Story 5.6): the holder's reminder window before the deadline.
 * A run reminds about every `ACTIVE` reservation whose `reservationDueAt` falls
 * within the next 48 hours; the deadline itself is excluded (step 1 takes it).
 */
export const RESERVATION_REMINDER_WINDOW_MS = 48 * 60 * 60 * 1000;

/**
 * The columns every timer predicate reads: a phase of a live, non-archived
 * reservation. An archived wish is read-only (AD-8), so it is never a candidate
 * even when its columns look due.
 */
export type ReservationPhaseRow = {
  readonly status: GiftStatusRow["status"];
  readonly archivedAt: Date | null;
  readonly reservationPhase: ReservationPhase | null;
};

/** Step 1 reads the deadline: a phase without one is never due. */
export type ReservationDueRow = ReservationPhaseRow & {
  readonly reservationDueAt: Date | null;
};

/** Step 2 reads the moment the current phase started. */
export type ReservationPhaseMomentRow = ReservationPhaseRow & {
  readonly reservationPhaseAt: Date | null;
};

/**
 * Step 3 reads the deadline and the phase moment: the deadline opens the
 * window, the moment keeps a row moved by step 2 of the same run out of it.
 * CLE-124/S9b-1: `bought` is not read anymore — it no longer protects the row.
 */
export type ReservationReleaseRow = ReservationDueRow & {
  readonly reservationPhaseAt: Date | null;
};

function hasLivePhase(row: ReservationPhaseRow, phase: ReservationPhase): boolean {
  return (
    row.status === "RESERVED" &&
    row.archivedAt === null &&
    row.reservationPhase === phase
  );
}

/** CLE-124/S9b-1: either of the two phases the timer may release from. */
function hasReleasablePhase(row: ReservationPhaseRow): boolean {
  return (
    row.status === "RESERVED" &&
    row.archivedAt === null &&
    row.reservationPhase !== null &&
    (RELEASABLE_RESERVATION_PHASES as readonly ReservationPhase[]).includes(
      row.reservationPhase,
    )
  );
}

/**
 * Story 5.6 (AD-9), step 1: may the timer report the giver's deadline as passed?
 * Only `RESERVED/ACTIVE` whose `reservationDueAt` is at or before `now` — the
 * boundary is inclusive, so a run at exactly `dueAt` already moves the phase.
 */
export function canExpireToGiver(row: ReservationDueRow, now: Date): boolean {
  return (
    hasLivePhase(row, "ACTIVE") &&
    row.reservationDueAt !== null &&
    row.reservationDueAt.getTime() <= now.getTime()
  );
}

/**
 * Story 5.6 (AD-9), step 2: may the timer ask the owner? Only
 * `RESERVED/AWAITING_GIVER` whose phase started at least 72 hours ago;
 * `phaseAt == now − 72 ч` passes, one millisecond later does not.
 */
export function canAskOwner(row: ReservationPhaseMomentRow, now: Date): boolean {
  return (
    hasLivePhase(row, "AWAITING_GIVER") &&
    row.reservationPhaseAt !== null &&
    row.reservationPhaseAt.getTime() <= now.getTime() - RESERVATION_GIVER_WINDOW_MS
  );
}

/**
 * Story 5.6 (AD-9), step 3, CLE-124/D-49/S9b-1: may the timer release the
 * reservation by expiry? Only a live `RESERVED` row in one of
 * {@link RELEASABLE_RESERVATION_PHASES} whose `reservationDueAt` is at least 168
 * hours old. `bought` and `GIVEN` do not protect the row: «Купил» is the
 * holder's own note and «Подарил» a promise, and neither may keep a wish blocked
 * forever. A row whose phase started at `now` (step 2 of the same run) is
 * refused: one run moves a row one step, and the release waits for the next run.
 */
export function canReleaseByExpiry(row: ReservationReleaseRow, now: Date): boolean {
  return (
    hasReleasablePhase(row) &&
    row.reservationDueAt !== null &&
    row.reservationDueAt.getTime() <= now.getTime() - RESERVATION_OWNER_WINDOW_MS &&
    row.reservationPhaseAt !== null &&
    row.reservationPhaseAt.getTime() < now.getTime()
  );
}

export type HolderAccessInput = {
  /** Current status; only `RESERVED` can lose a reservation. */
  readonly status: GiftStatusRow["status"];
  /** Owner of the list (and of the wish); the viewer relation is read against them. */
  readonly ownerId: string;
  /** `Gift.reservedById`; a reserved row always carries one. */
  readonly holderId: string;
  readonly previousVisibility: GiftVisibility;
  readonly nextVisibility: GiftVisibility;
  /**
   * Relation facts of the holder to the owner, from the `RelationshipReader`
   * port. The list link is added here: it exists for every list, so the holder
   * who reserved through `/l/:token` keeps that route when the owner narrows the
   * wish. A friendship, subscription, contact match or block still comes from
   * the reader.
   */
  readonly relations: Omit<ViewerRelations, "viaListToken">;
};

/**
 * Does the visibility change take the holder's access away? (AD-7, FR-10 ред.
 * 2026-11-11.)
 *
 * The owner and the write path share this one function, so the confirm preflight
 * and the actual release can never disagree. The evaluation is the ordinary
 * AD-7 gift filter, **without** the A-14 reservation-card exception: otherwise
 * `SECRET` would never release a reservation. A release happens only when the
 * holder could see the wish before the change and cannot see it after it:
 *
 * - `PUBLIC → FRIENDS` for an accepted friend keeps the reservation;
 * - `PUBLIC → FRIENDS` for a link visitor, subscriber or contact match releases it;
 * - any `→ SECRET` releases it when the holder had access before;
 * - a block, or a narrowing while the holder already had no access, releases
 *   nothing — that is A-14: a lost relation alone does not cancel a reservation;
 * - the same value is no change and releases nothing.
 */
export function visibilityChangeDropsReservation(input: HolderAccessInput): boolean {
  if (input.status !== "RESERVED") return false;

  // AD-7: the owner's shared link exists for every list, so a holder who
  // reserved through it is not cut off by the owner's own request context.
  const relations: ViewerRelations = { ...input.relations, viaListToken: true };
  const viewer = { id: input.holderId };

  function holderCanSee(visibility: GiftVisibility): boolean {
    return VisibilityPolicy.canSee(viewer, relations, {
      ownerId: input.ownerId,
      visibility,
      archivedAt: null,
    });
  }

  return holderCanSee(input.previousVisibility) && !holderCanSee(input.nextVisibility);
}
