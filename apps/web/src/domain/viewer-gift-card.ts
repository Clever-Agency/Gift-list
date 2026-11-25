// AD-7 viewer branch / AD-12 wire card (D-13). Rules only: callers hand over a
// plain row (no Prisma types) and get the `GiftCard` a non-owner may see. The
// holder and everybody else share one shape; only reservation facts differ.

import { DEFAULT_LOCALE, type GiftCard, type SupportedLocale } from "@gift-list/contracts";
import { calendarDay } from "./calendar-day";
import { reservationDueOn } from "./reservation-due";
import type { OwnerGiftRow } from "./owner-gift-card";
import { toGiftTags } from "./tag";

/** Plain row the viewer mapper reads; adds the reservation facts D-13 uses. */
export type ViewerGiftRow = OwnerGiftRow & {
  reservationPhase: "ACTIVE" | "AWAITING_GIVER" | "AWAITING_OWNER" | "GIVEN" | null;
  holderVisibleToOwner: boolean;
  reservedBy: { id: string; nick: string; name: string } | null;
  reservationBought: boolean;
  holderVisibleToOthers: boolean;
  reservationDueAt: Date | null;
  reservationTimeZone: string | null;
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
  locale: SupportedLocale = DEFAULT_LOCALE,
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
    tags: toGiftTags(row.tags, locale),
    status: row.status,
    reservedBy: reservedBy(row, viewerId),
    reservationLabel: reservationLabel(row),
    ownerAction: null,
    reservation: holderReservation(row, viewerId),
  };
}

function holderReservation(
  row: ViewerGiftRow,
  viewerId: string | null,
): GiftCard["reservation"] {
  if (row.status !== "RESERVED" || viewerId === null) return undefined;
  const holder = row.reservedBy;
  if (holder === null || holder.id !== viewerId) return undefined;
  if (row.reservationPhase === null || row.reservationDueAt === null) return undefined;

  const timeZone = row.reservationTimeZone ?? "UTC";
  return {
    dueAt: reservationDueOn(row.reservationDueAt, timeZone),
    phase: row.reservationPhase,
    bought: row.reservationBought,
    // CLE-124/D-49: the owner never sees the holder, so the flag is always false.
    holderVisibleToOwner: false,
    holderVisibleToOthers: row.holderVisibleToOthers,
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
