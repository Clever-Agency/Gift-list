// AD-7 owner branch / AD-12 wire card. Rules only: callers hand over a plain row
// (no Prisma types) and get the `GiftCard` the owner may see. Shared by the
// list read (Story 2.1) and the create use-case (Story 2.2).

import type { GiftCard } from "@gift-list/contracts";
import type { GiftVisibility } from "./visibility";

/** Plain row the owner mapper reads; keeps Prisma types out of the mapping rules. */
export type OwnerGiftRow = {
  id: string;
  title: string;
  description: string | null;
  priceAmount: number | null;
  priceCurrency: GiftCard["priceCurrency"];
  linkUrl: string | null;
  visibility: GiftVisibility;
  quantity: GiftCard["quantity"];
  expiresOn: Date | null;
  archivedAt: Date | null;
  status: GiftCard["status"];
  reservationPhase: "ACTIVE" | "AWAITING_GIVER" | "AWAITING_OWNER" | "GIVEN" | null;
  holderVisibleToOwner: boolean;
  reservedBy: { id: string; nick: string; name: string } | null;
};

/**
 * Owner gift card (AD-7 read matrix, AD-12): no holder identity unless the holder
 * allowed it, no `bought`, `dueAt` or reservation label; the owner action comes
 * from the reservation phase instead. Tags arrive with Story 2.5. Closing keeps
 * `reserved*` for audit (AD-8), so a CLOSED gift keeps the holder when the
 * toggle is on and still hides it when off (FR-31).
 */
export function toOwnerGiftCard(row: OwnerGiftRow): GiftCard {
  const holder = row.holderVisibleToOwner ? row.reservedBy : null;
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
    reservedBy: holder
      ? { id: holder.id, nick: holder.nick, displayName: holder.name }
      : null,
    reservationLabel: null,
    ownerAction: ownerAction(row),
  };
}

/** The owner answers a finished reservation only while it is still open (AD-7). */
function ownerAction(row: OwnerGiftRow): GiftCard["ownerAction"] {
  if (row.status !== "RESERVED") return null;
  switch (row.reservationPhase) {
    case "AWAITING_OWNER":
      return "EXPIRED_NO_REPLY";
    case "GIVEN":
      return "CONFIRM_GIVEN";
    default:
      return null;
  }
}

/** `Gift.expiresOn` is a date column; the wire keeps a plain ISO calendar day. */
function calendarDay(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}
