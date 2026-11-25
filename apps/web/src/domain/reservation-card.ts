// Story 5.5 (FR-25, A-14, AD-7/AD-12): the holder's reservation card. Rules only:
// callers hand over a plain row (no Prisma types) and get the closed wire card.
// The list of cards is read by `reservedById` and never passes the wishlist gate,
// so the card must keep working after an unfriend or a block — that is A-14.

import type { ReservationCard } from "@gift-list/contracts";
import type { ReservationPhase } from "./gift-status";
import { reservationDueOn } from "./reservation-due";
import { VisibilityPolicy, type GiftVisibility, type ViewerRelations } from "./visibility";

/**
 * Relations of the holder to the owner. `viaListToken` is deliberately absent:
 * the card never carries a list token, so a reservation first made through
 * `/l/:token` cannot count as token access later. Such a card keeps every action
 * but answers `canOpenGift: false`, as AD-7 requires.
 */
export type ReservationRelations = Omit<ViewerRelations, "viaListToken">;

/**
 * Plain row the reservation-card mapper reads. Every field is part of the closed
 * card set or decides `canOpenGift`; the query behind it selects exactly these
 * columns, so no price, tag, description, link or `visibility` travels.
 *
 * `reservationPhase` and `reservationDueAt` are non-null here on purpose: an
 * incomplete `RESERVED` row is a data anomaly the read skips before mapping.
 */
export type ReservationCardRow = {
  readonly id: string;
  readonly status: "OPEN" | "RESERVED" | "CLOSED";
  readonly title: string;
  /** The title as it was at the moment of reserving (Story 5.1). */
  readonly titleSnapshotOnReserve: string | null;
  /** Exclusive end of the chosen day, read back as a calendar day. */
  readonly reservationDueAt: Date;
  readonly reservationTimeZone: string | null;
  readonly reservationPhase: ReservationPhase;
  readonly reservationBought: boolean;
  readonly holderVisibleToOwner: boolean;
  readonly holderVisibleToOthers: boolean;
  readonly visibility: GiftVisibility;
  readonly archivedAt: Date | null;
  /** The holder asking; the card is only read for rows they reserved. */
  readonly reservedById: string;
  readonly list: {
    readonly ownerId: string;
    readonly owner: { readonly nick: string };
  };
};

/**
 * Would the holder still pass AD-7 into the wish detail? The server answers this
 * with the same `VisibilityPolicy.canSee` the ordinary read uses, and with the
 * same relations — except the list token, which `Мои брони` does not carry. So a
 * friendship, a subscription or a contact match keeps the door open, while an
 * unfriend, a block on either side, a narrowed `visibility` or a link-only
 * reservation closes it. The boolean never explains the cause.
 */
export function canOpenGift(
  row: ReservationCardRow,
  relations: ReservationRelations,
): boolean {
  if (row.status !== "RESERVED") return false;
  return VisibilityPolicy.canSee(
    { id: row.reservedById },
    { ...relations, viaListToken: false },
    {
      ownerId: row.list.ownerId,
      visibility: row.visibility,
      archivedAt: row.archivedAt,
    },
  );
}

/**
 * The closed card of one live reservation (AD-7, AD-12). `dueAt` is the calendar
 * day the holder picked, restored from the exclusive end of that day in the
 * snapshot zone; the zone itself stays on the server. `titleSnapshot` is the
 * moment-of-reserving title, so an owner's rename never rewrites the card; a
 * missing snapshot (an anomaly) falls back to the current title rather than
 * showing an empty heading.
 */
export function toReservationCard(
  row: ReservationCardRow,
  relations: ReservationRelations,
): ReservationCard {
  return {
    giftId: row.id,
    titleSnapshot: titleSnapshot(row),
    status: "RESERVED",
    ownerNick: row.list.owner.nick,
    dueAt: reservationDueOn(row.reservationDueAt, row.reservationTimeZone ?? "UTC"),
    phase: row.reservationPhase,
    bought: row.reservationBought,
    // CLE-124/D-49: the owner never sees the holder, so the flag is always false.
    holderVisibleToOwner: false,
    holderVisibleToOthers: row.holderVisibleToOthers,
    canOpenGift: canOpenGift(row, relations),
  };
}

function titleSnapshot(row: ReservationCardRow): string {
  const snapshot = row.titleSnapshotOnReserve;
  return snapshot === null || snapshot.trim() === "" ? row.title : snapshot;
}
