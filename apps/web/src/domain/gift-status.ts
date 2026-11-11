// AD-8 / AD-9 — `GiftStatusService`. Rules only: no Prisma, no React/Next.js
// here (AD-1). The Prisma adapter in `lib/gift-status-store.ts` owns the write
// and runs inside the caller's transaction.
//
// First slice of the service (CLE-82/S23.2): the owner's `RESERVED → OPEN`
// transition, which is also the silent release when a narrowed visibility takes
// the holder's access away. Create, close, undo, archive, cron and account
// deletion stay in their own stories.

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

/** Only a live reservation is released; an OPEN or CLOSED row has nothing to clear. */
export function hasActiveReservation(row: GiftStatusRow): boolean {
  return row.status === "RESERVED";
}

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
