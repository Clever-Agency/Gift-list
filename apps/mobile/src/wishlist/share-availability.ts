import { isWishVisibleToEveryone, type GiftCard } from "@gift-list/contracts";

/**
 * A share link is worth offering exactly when at least one wish is visible to
 * everyone on the public list (`/l/:token`). The rule itself lives in
 * `@gift-list/contracts`: the server's `VisibilityPolicy` uses the same one, so
 * the copy control and the public read cannot drift apart. Reserved or closed
 * wishes still appear on the public page, so they count; archived ones do not
 * (`AD-7` makes them owner-only).
 */
export function hasWishVisibleToEveryone(gifts: readonly GiftCard[]): boolean {
  return gifts.some(isWishVisibleToEveryone);
}
