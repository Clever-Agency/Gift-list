// AD-7 owner branch / AD-12 wire card. Rules only: callers hand over a plain row
// (no Prisma types) and get the `GiftCard` the owner may see. Shared by the
// list read (Story 2.1) and the create use-case (Story 2.2).

import { DEFAULT_LOCALE, type GiftCard, type SupportedLocale } from "@gift-list/contracts";
import { calendarDay } from "./calendar-day";
import { undoUntil } from "./gift-status";
import { toGiftTags, type GiftTagRow } from "./tag";
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
  /** Story 5.3: the moment of closing, read only to compute `undoUntil`. */
  closedAt: Date | null;
  tags: readonly GiftTagRow[];
  status: GiftCard["status"];
};

/**
 * Owner gift card (AD-7 read matrix, AD-12, D-49): a gift is a surprise, so the
 * owner's card carries no sign of a reservation at all — a `RESERVED` wish reads
 * as `OPEN`, `reservedBy`, `ownerAction` and `reservationLabel` are always
 * `null`, and the mapper does not even read the reservation columns (`bought`,
 * `dueAt`, phase, toggles). A `CLOSED` wish keeps its own status, but its past
 * holder stays hidden too. Tags arrive with Story 2.5: fixed tags are labelled in
 * the request language, custom ones show their own text (AD-27).
 *
 * Story 5.3 (ARCH-A5): the owner card carries `undoUntil`, the server-computed
 * end of the undo window — `null` for a wish that is not closed.
 */
export function toOwnerGiftCard(
  row: OwnerGiftRow,
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
    status: row.status === "RESERVED" ? "OPEN" : row.status,
    reservedBy: null,
    reservationLabel: null,
    ownerAction: null,
    undoUntil: undoUntil(row)?.toISOString() ?? null,
  };
}
