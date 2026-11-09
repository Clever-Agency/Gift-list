import type { VISIBILITIES } from "./enums";

/** Closed `Gift.visibility` set (AD-7). */
export type GiftVisibilityValue = (typeof VISIBILITIES)[number];

/** The minimum a wish needs for the public-link rule; both `Date` and wire strings are accepted. */
export type WishVisibleToEveryone = {
  readonly visibility: GiftVisibilityValue;
  readonly archivedAt: string | Date | null;
};

/**
 * AD-7: the only wishes a shared link shows to everyone are `PUBLIC` and not
 * archived. Reserved and closed wishes still appear there (the server does not
 * hide them), while an archived wish is owner-only. The app uses this rule to
 * decide whether copying a share link is worth offering; the server uses the
 * same rule inside `VisibilityPolicy` so the two can never drift.
 */
export function isWishVisibleToEveryone(gift: WishVisibleToEveryone): boolean {
  return gift.visibility === "PUBLIC" && gift.archivedAt === null;
}
