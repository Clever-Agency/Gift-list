/**
 * The fields the form edits, as the form holds them while typing: the price is
 * its text, not minor units, so `"250"` and `"250.00"` count as different edits
 * even though `parsePriceToMinor` gives the same amount (AD-25).
 */
export type GiftFormDirtyValues = {
  title: string;
  description: string;
  link: string;
  /** The price field as typed, e.g. `"250,50"`. */
  price: string;
  currency: string;
  visibility: string;
  /** `SINGLE` or `UNLIMITED` (Story 2.5). */
  quantity: string;
  /** Selected tags as an order-independent key; fixed labels are not part of it. */
  tags: string;
  /** The custom tag field as typed but not added yet. */
  customTag: string;
};

const FIELDS = [
  "title",
  "description",
  "link",
  "price",
  "currency",
  "visibility",
  "quantity",
  "tags",
  "customTag",
] as const;

/** `"  Свитер  "` and `"Свитер"` are the same draft: surrounding spaces are not an edit. */
function normalized(value: string): string {
  return value.trim();
}

/**
 * Whether the draft differs from the values the form was opened with
 * (`EXPERIENCE.md` → Esc / scrim / системное «назад»: «Черновик формы не теряется
 * молча: при изменениях — шаг «Сохранить изменения?»», `DESIGN.md` →
 * BottomSheet / Dialog). Pure: the form calls it on every render and reports the
 * result through `onDirtyChange`.
 */
export function isGiftFormDirty(
  initial: GiftFormDirtyValues,
  current: GiftFormDirtyValues,
): boolean {
  return FIELDS.some((field) => normalized(initial[field]) !== normalized(current[field]));
}
