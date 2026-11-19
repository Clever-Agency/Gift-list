// AD-8 / AD-9 — `GiftStatusService`. Rules only: no Prisma, no React/Next.js
// here (AD-1). The Prisma adapter in `lib/gift-status-store.ts` owns the write.
//
// CLE-82/S23.2: the owner's `RESERVED → OPEN` release, including the silent
// release when a narrowed visibility takes the holder's access away.
// Story 2.6: archiving an expired open wish and restoring it are writes in that
// same adapter. Whether a day is already past is `isBeforeLocalToday`.

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
 * Story 5.2/5.3 (NFR-6): the transitions the one seam reports. The list is
 * shared, so 5.2 and 5.3 cannot write the same event differently.
 */
export type GiftStatusEventKind =
  | "RESERVATION_RELEASED_BY_HOLDER"
  | "RESERVATION_RELEASED_BY_OWNER"
  | "WISH_CLOSED"
  | "WISH_REOPENED";

/**
 * The payload of {@link RecordGiftEvent}: identifiers and the transition only —
 * no names, nicks, emails or titles (FR-31).
 */
export type GiftStatusEvent = {
  readonly giftId: string;
  readonly actorId: string;
  readonly from: GiftStatusRow["status"];
  readonly to: GiftStatusRow["status"];
  readonly at: Date;
  readonly kind: GiftStatusEventKind;
};

/**
 * The single seam of NFR-6 that the store implements (Story 5.2 declares it,
 * Story 5.3 reuses it). Today the implementation writes one audit line
 * (variant A); a `Notification` row (variant B) replaces only that body, so no
 * caller or CAS method changes.
 */
export type RecordGiftEvent = (event: GiftStatusEvent) => void;

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
  releaseReservation(giftId: string): Promise<boolean>;
  /**
   * Story 5.1: CAS `OPEN → RESERVED` for a single, non-archived wish. A row that
   * no longer matches the predicate is left untouched and answers `lost`.
   */
  reserveGift(giftId: string, data: ReserveGiftWrite): Promise<"success" | "lost">;
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
}

/** Only a single open wish can be reserved; unlimited gifts are rejected upstream. */
export function canReserveGift(row: ReserveEligibleRow): boolean {
  return (
    row.status === "OPEN" &&
    row.quantity === "SINGLE" &&
    row.archivedAt === null
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
