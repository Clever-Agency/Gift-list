// AD-7 viewer branch / AD-12 wire card (D-13). Rules only: callers hand over a
// plain row (no Prisma types) and get the `GiftCard` a non-owner may see. The
// holder and everybody else share one shape; only reservation facts differ.

import type { GiftCard } from "@gift-list/contracts";
import { calendarDay } from "./calendar-day";
import type { OwnerGiftRow } from "./owner-gift-card";

/** Plain row the viewer mapper reads; adds the two reservation facts D-13 uses. */
export type ViewerGiftRow = OwnerGiftRow & {
  reservationBought: boolean;
  holderVisibleToOthers: boolean;
};

/**
 * Viewer gift card (AD-7 read matrix, AD-12, D-13): the holder always learns
 * that they hold the gift, everybody else only while `holderVisibleToOthers` is
 * on. `ownerAction` stays owner-only and the phase columns never reach the wire:
 * `bought` becomes `reservationLabel`, while `dueAt` and phases stay hidden.
 * Epic 5 adds the holder's own reservation fields without touching the card.
 * Closing keeps `reserved*` for audit (AD-8), so a CLOSED gift follows the same
 * toggle; an OPEN gift never carries a holder, even with leftover columns.
 */
export function toViewerGiftCard(
  row: ViewerGiftRow,
  viewerId: string | null,
): GiftCard {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    priceAmount: row.priceAmount,
    priceCurrency: row.priceCurrency,
    linkUrl: row.linkUrl,
    visibility: row.visibility,
    quantity: row.quantity,
    expiresOn: calendarDay(row.expiresOn),
    archivedAt: row.archivedAt?.toISOString() ?? null,
    tags: [],
    status: row.status,
    reservedBy: reservedBy(row, viewerId),
    reservationLabel: reservationLabel(row),
    ownerAction: null,
  };
}

/**
 * Holder identity by role: the holder sees themself while the reservation is
 * live, others need the toggle. `OPEN` never exposes a leftover holder.
 */
function reservedBy(
  row: ViewerGiftRow,
  viewerId: string | null,
): GiftCard["reservedBy"] {
  if (row.status === "OPEN") return null;

  const holder = row.reservedBy;
  if (holder === null) return null;

  const isHolder =
    viewerId !== null &&
    holder.id === viewerId &&
    row.status === "RESERVED";
  if (!isHolder && !row.holderVisibleToOthers) return null;

  return { id: holder.id, nick: holder.nick, displayName: holder.name };
}

/** Only a live reservation has a label; `GIVEN` wins over `BOUGHT` (D-13). */
function reservationLabel(row: ViewerGiftRow): GiftCard["reservationLabel"] {
  if (row.status !== "RESERVED") return null;
  if (row.reservationPhase === "GIVEN") return "GIVEN";
  return row.reservationBought ? "BOUGHT" : null;
}
