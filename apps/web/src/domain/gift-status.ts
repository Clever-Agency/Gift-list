// AD-8 / AD-9 — `GiftStatusService`. Rules only: no Prisma, no React/Next.js
// here (AD-1). The Prisma adapter in `lib/gift-status-store.ts` owns the write.
//
// CLE-82/S23.2: the owner's `RESERVED → OPEN` release, including the silent
// release when a narrowed visibility takes the holder's access away.
// Story 2.6: archiving an expired open wish and restoring it are writes in that
// same adapter. Whether a day is already past is `isBeforeLocalToday`.
// Story 5.6: the reservation timers of AD-9 (72 and 168 hours) and the owner's
// keep answer. The rules are pure; the CAS writes live in the same adapter.

import { RESERVATION_PHASES } from "@gift-list/contracts";
import type { GiftEditEventField } from "./gift-edit";
import { defaultReserveDueOn, reservationDueAtFromDueOn } from "./reservation-due";
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
  readonly holderVisibleToOwner: boolean;
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

/** Story 5.5: both toggles of the holder's visibility arrive in one body. */
export type SetReservationVisibilityWrite = {
  readonly holderVisibleToOwner: boolean;
  readonly holderVisibleToOthers: boolean;
};

/**
 * Story 5.5: the phases an extension may leave. `GIVEN` is not one of them — it
 * waits for the owner's confirmation (Story 5.7) and its expiry timers are
 * stopped, so an extension would silently restart them. The store's CAS uses this
 * exact list, so the pre-check and the write cannot drift apart.
 */
export const EXTENDABLE_RESERVATION_PHASES = [
  "ACTIVE",
  "AWAITING_GIVER",
  "AWAITING_OWNER",
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
 * Story 5.6 reports the reservation cycle, where three of the four transitions
 * keep `RESERVED → RESERVED` and only the expiry release changes the status; the
 * `kind` is what tells those phase moves apart.
 */
export type GiftStatusEventKind =
  | "RESERVATION_RELEASED_BY_HOLDER"
  | "RESERVATION_RELEASED_BY_OWNER"
  | "WISH_CLOSED"
  | "WISH_REOPENED"
  | "GIFT_EDITED"
  | "GIFT_DELETED"
  | "RESERVATION_GIVER_DEADLINE_PASSED"
  | "RESERVATION_OWNER_ASKED"
  | "RESERVATION_RELEASED_BY_EXPIRY"
  | "RESERVATION_KEPT_BY_OWNER";

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
 * and a made-up `"system"` actor would blur the difference; keep carries the
 * owner, so the field is widened to `string | null` rather than sentinel-filled.
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
   * Story 5.2: CAS `RESERVED → OPEN` for the owner of the list the wish belongs
   * to. The predicate carries ownership, so a foreign wish, a closed wish or a
   * reservation already gone is left untouched and answers `lost`.
   */
  releaseReservationByOwner(
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
   * Story 5.6 (AD-9): CAS `AWAITING_OWNER → OPEN` after the 168-hour window when
   * the holder did not mark the gift as bought. The write is the same
   * `RESERVATION_RELEASE_DATA` the 5.2 releases use.
   */
  releaseReservationByExpiry(giftId: string, at: Date): Promise<"success" | "lost">;
  /**
   * Story 5.6 (AD-9): CAS `AWAITING_OWNER → ACTIVE` for the owner of the list.
   * Only the phase, its moment and the deadline change; the zone snapshot, the
   * `bought` mark and the status stay.
   */
  keepReservationByOwner(
    giftId: string,
    actorId: string,
    write: KeepReservationWrite,
  ): Promise<"success" | "lost">;
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

/**
 * Story 5.5: may this reservation be extended? Only a live `RESERVED` row in one
 * of {@link EXTENDABLE_RESERVATION_PHASES}; `GIVEN` refuses on purpose, and an
 * incomplete row (no phase) is refused too. The server re-checks the same rule in
 * the CAS, so a stale answer can only lose the race, never write.
 */
export function canExtendReservation(row: ReservationAttributeRow): boolean {
  if (row.status !== "RESERVED" || row.reservationPhase === null) return false;
  return (EXTENDABLE_RESERVATION_PHASES as readonly ReservationPhase[]).includes(
    row.reservationPhase,
  );
}

/**
 * Story 5.5 (AD-9): `bought` and the two visibility toggles are attributes of any
 * live reservation — every phase, `GIVEN` included, may change them. Only the
 * status limits them; an `OPEN` or `CLOSED` row is not a reservation anymore.
 */
export function canSetReservationAttributes(row: GiftStatusRow): boolean {
  return row.status === "RESERVED";
}

/**
 * Story 5.6 (AD-9): the two windows of the reservation cycle. After
 * `reservationDueAt` has passed the giver has 72 hours before the owner gets the
 * question; once asked, the owner has 168 hours to answer before the reservation
 * is released. Both are counted from `reservationPhaseAt` (ARCH-A15), never from
 * `reservationDueAt`, so a skipped run postpones a transition instead of letting
 * it jump over the owner's window.
 */
export const RESERVATION_GIVER_WINDOW_MS = 72 * 60 * 60 * 1000;
export const RESERVATION_OWNER_WINDOW_MS = 168 * 60 * 60 * 1000;

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

/** Steps 2 and 3 read the moment the current phase started. */
export type ReservationPhaseMomentRow = ReservationPhaseRow & {
  readonly reservationPhaseAt: Date | null;
};

/** Step 3 also refuses a gift the holder already marked as bought. */
export type ReservationReleaseRow = ReservationPhaseMomentRow & {
  readonly reservationBought: boolean;
};

function hasLivePhase(row: ReservationPhaseRow, phase: ReservationPhase): boolean {
  return (
    row.status === "RESERVED" &&
    row.archivedAt === null &&
    row.reservationPhase === phase
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
 * Story 5.6 (AD-9), step 3: may the timer release the reservation by expiry?
 * Only `RESERVED/AWAITING_OWNER` whose question is at least 168 hours old and
 * that the holder did not mark as bought — «Купил» always wins over the timer.
 */
export function canReleaseByExpiry(row: ReservationReleaseRow, now: Date): boolean {
  return (
    hasLivePhase(row, "AWAITING_OWNER") &&
    !row.reservationBought &&
    row.reservationPhaseAt !== null &&
    row.reservationPhaseAt.getTime() <= now.getTime() - RESERVATION_OWNER_WINDOW_MS
  );
}

/**
 * Story 5.6 (AD-9): may the owner answer «Не получал, оставить бронь»? Only a
 * live `RESERVED/AWAITING_OWNER` row of the owner's own list; `GIVEN` waits for
 * Story 5.7 and every other phase has nothing to keep.
 */
export function canKeepReservation(row: ReservationPhaseRow): boolean {
  return hasLivePhase(row, "AWAITING_OWNER");
}

/**
 * Story 5.6 (AD-9, ARCH-A14): the deadline a keep writes — the exclusive end of
 * the calendar day «today + 7» in the zone saved with the reservation. The zone
 * is the holder's snapshot and is not re-read from the owner; a blank or unknown
 * snapshot falls back to UTC instead of throwing on an anomalous row.
 */
export function keptReservationDueAt(now: Date, timeZone: string | null): Date {
  const zone = zonedOrUtc(timeZone);
  return reservationDueAtFromDueOn(defaultReserveDueOn(zone, now), zone);
}

/**
 * The same fallback as `calendar-day.ts` and `lib/time-zone.ts`: a zone the
 * runtime cannot resolve means UTC. Kept local so the domain stays free of any
 * other layer; the store never writes the resolved value back.
 */
function zonedOrUtc(timeZone: string | null): string {
  if (timeZone === null || timeZone.trim() === "") return "UTC";
  try {
    Intl.DateTimeFormat("en-US", { timeZone }).format(0);
    return timeZone;
  } catch {
    return "UTC";
  }
}

/**
 * Story 5.6 (AD-9): the owner's keep writes the phase back to `ACTIVE`, its
 * moment and the new deadline only. `reservationTimeZone` (the holder's snapshot),
 * `reservationBought` (the holder's mark) and `status` are deliberately absent.
 */
export type KeepReservationWrite = {
  readonly dueAt: Date;
  readonly at: Date;
};

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
