import { GIFT_TAG_TEXT_MAX, type GiftTagInput } from "@gift-list/contracts";

/**
 * A tag as the form holds it. A fixed tag keeps the server-provided label for
 * display, but only `catalogId` identifies it: a locale change or a catalogue
 * refetch must not make an unchanged draft dirty. A custom tag has only its
 * trimmed text; the server does not translate it (AD-22, AD-27).
 */
export type GiftFormTag =
  | { catalogId: string; label: string }
  | { text: string };

/** The identity of a tag, independent of display order and fixed-tag labels. */
export function giftTagKey(tag: GiftFormTag): string {
  return "catalogId" in tag ? `catalog:${tag.catalogId}` : `custom:${tag.text}`;
}

export function isFixedTag(
  tag: GiftFormTag,
): tag is { catalogId: string; label: string } {
  return "catalogId" in tag;
}

export function isCustomTag(tag: GiftFormTag): tag is { text: string } {
  return "text" in tag;
}

/** The visible text of a tag: the server label or the owner's own text. */
export function giftTagLabel(tag: GiftFormTag): string {
  return "catalogId" in tag ? tag.label : tag.text;
}

/** The contract body of one tag: exactly one source, never both (2.5.5). */
export function giftTagInput(tag: GiftFormTag): GiftTagInput {
  return "catalogId" in tag ? { catalogId: tag.catalogId } : { text: tag.text };
}

/** The create/edit body for the selected set. */
export function giftTagInputs(tags: readonly GiftFormTag[]): GiftTagInput[] {
  return tags.map(giftTagInput);
}

/** The stored AD-12 card tag back into the form's shape. */
export function giftTagFromCard(tag: {
  catalogId: string | null;
  label: string;
}): GiftFormTag {
  return tag.catalogId === null
    ? { text: tag.label }
    : { catalogId: tag.catalogId, label: tag.label };
}

/**
 * Sets are equal when they hold the same tags in any order. Fixed labels are
 * display only, so their text does not count: a catalogue in another language
 * is still the same choice.
 */
export function giftTagsEqual(
  left: readonly GiftFormTag[],
  right: readonly GiftFormTag[],
): boolean {
  return giftTagsKey(left) === giftTagsKey(right);
}

/** A stable, order-independent key for dirty tracking and set comparison. */
export function giftTagsKey(tags: readonly GiftFormTag[]): string {
  // JSON rather than a delimiter: custom text may contain any newline/colon
  // sequence, and two different sets must never share a dirty key.
  return JSON.stringify(tags.map(giftTagKey).sort());
}

/** Length in Unicode code points, the unit of `VARCHAR(30)` and the contract. */
export function tagTextLength(text: string): number {
  return [...text].length;
}

/** Why a custom tag cannot be added; `null` means it can. */
export type CustomTagIssue = "empty" | "tooLong" | "duplicate" | "invalid";

/**
 * Client-side rule of the custom tag. Trim happens before every check, so only
 * the text that would reach the server is measured and compared. NUL is
 * rejected because PostgreSQL cannot store it in `VARCHAR` and the contract
 * would answer VALIDATION after a request.
 */
export function customTagIssue(
  raw: string,
  selected: readonly GiftFormTag[],
): CustomTagIssue | null {
  const text = raw.trim();
  if (text === "") return "empty";
  if (text.includes("\u0000")) return "invalid";
  if (tagTextLength(text) > GIFT_TAG_TEXT_MAX) return "tooLong";
  if (selected.some((tag) => "text" in tag && tag.text === text)) return "duplicate";
  return null;
}
