// Story 5.4 (FR-31, AD-14): an edit of a reserved wish is reported through the
// one seam of NFR-6 (`recordGiftEvent`) with the **names** of the significant
// fields that really changed. The line never carries a value: after a narrowed
// visibility the holder may lose access to the wish, so a title, description or
// price in the audit line would become a leak channel. Pure rules only — no
// Prisma, no React/Next.js (AD-1).

/**
 * The closed set of significant fields of {@link changedGiftFields}, in the order
 * the event lists them. `price` is one product-level field: in the model it is
 * the pair `priceAmount` + `priceCurrency` (AD-25), which changes together.
 *
 * Tags, `expiresOn`, `visibility` and `quantity` are deliberately absent: a PATCH
 * that touches only them is not a significant edit of a reserved wish.
 */
export const GIFT_EDIT_EVENT_FIELDS = ["title", "description", "linkUrl", "price"] as const;

export type GiftEditEventField = (typeof GIFT_EDIT_EVENT_FIELDS)[number];

/**
 * The columns an edit is compared on: the stored row and the row the write will
 * store. Callers resolve absent request keys to the stored value first, so a
 * resent value is not a change.
 */
export type GiftEditComparable = {
  readonly title: string;
  readonly description: string | null;
  readonly linkUrl: string | null;
  readonly priceAmount: number | null;
  readonly priceCurrency: string | null;
};

/**
 * Story 5.4: which significant fields the edit really changes, compared on the
 * values themselves (stored versus stored-after-write), not on the request body.
 * The answer is empty when nothing significant changed and otherwise follows
 * {@link GIFT_EDIT_EVENT_FIELDS}, so one edit always reports the same order.
 */
export function changedGiftFields(
  before: GiftEditComparable,
  after: GiftEditComparable,
): GiftEditEventField[] {
  const changed: GiftEditEventField[] = [];
  if (before.title !== after.title) changed.push("title");
  if (before.description !== after.description) changed.push("description");
  if (before.linkUrl !== after.linkUrl) changed.push("linkUrl");
  if (
    before.priceAmount !== after.priceAmount ||
    before.priceCurrency !== after.priceCurrency
  ) {
    changed.push("price");
  }
  return changed;
}
