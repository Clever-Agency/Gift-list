import type { GiftCard } from "@gift-list/contracts";

/**
 * The public list (`/l/:token`) shows only non-archived `PUBLIC` wishes. A share
 * link is worth offering exactly when at least one such wish exists; reserved or
 * closed wishes still appear there, so they count. Archived ones do not: AD-7
 * makes them owner-only.
 */
export function hasWishVisibleToEveryone(gifts: readonly GiftCard[]): boolean {
  return gifts.some((gift) => gift.visibility === "PUBLIC" && gift.archivedAt === null);
}
