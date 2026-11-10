/**
 * Client rules of the gift form (Story 2.2, subtask 17) and the mapping of a
 * server `ActionError.field` onto the field that shows it. Pure on purpose: the
 * component stays presentation and the rules are unit-tested directly.
 *
 * `EXPERIENCE.md` → Ошибки форм and → Accessibility Floor: nothing is validated
 * while typing; on submit the first error is announced and stays under its
 * field until that field is edited.
 *
 * Lengths come from `@gift-list/contracts` and are measured with `textLength`,
 * the unit the schema uses (Unicode code points). A `maxLength` attribute would
 * cut text in UTF-16 units, i.e. cut an emoji the server accepts, so the form
 * does not set one and reports the length here instead.
 */
import {
  GIFT_DESCRIPTION_MAX,
  GIFT_LINK_URL_MAX,
  GIFT_TAG_TEXT_MAX,
  GIFT_TITLE_MAX,
  textLength,
} from "@gift-list/contracts";
import { parsePriceToMinor } from "@/ui/gift-price";
import type { CustomTagIssue } from "@/ui/gift-form-tags";

/** Fields that can carry an inline error; the currency rides with the price. */
export type GiftFormField =
  | "title"
  | "description"
  | "price"
  | "link"
  | "visibility"
  | "quantity"
  | "tags";

export type GiftFormErrors = Partial<Record<GiftFormField, true>>;

/**
 * The text fields as the form was opened with them (an edit prefill). A stored
 * value longer than the current cap is legacy data: the owner must be able to
 * change another field and save, so an untouched value is not reported here.
 * The edit screen leaves such a value out of the body as well, so the server
 * keeps the stored row instead of rejecting it (`toGiftUpdate` in
 * `app/(app)/gifts/[id]/edit.tsx`); a value the owner edits is always checked.
 */
export type GiftFormBaseline = {
  title: string;
  description: string;
  link: string;
};

/** Visual order of the form: the first error in it is focused and announced. */
const FIELD_ORDER = [
  "title",
  "description",
  "link",
  "price",
  "visibility",
  "quantity",
  "tags",
] as const satisfies readonly GiftFormField[];

/**
 * Same rule as `httpUrlSchema` in `packages/contracts/src/gift.ts`
 * (`z.url({ protocol: /^https?$/ })`): an absolute `http`/`https` URL with a
 * host. The `://` guard mirrors zod, which rejects `https:/path`, and the host
 * check covers parsers that accept a bare scheme.
 */
export function isHttpUrl(text: string): boolean {
  const value = text.trim();
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname !== "";
  } catch {
    return false;
  }
}

/** `EXPERIENCE.md` → Esc: surrounding spaces are not an edit either. */
function unchanged(value: string, baseline: string | undefined): boolean {
  return baseline !== undefined && value === baseline.trim();
}

/**
 * Runs on submit only. Empty description and link are valid (D-25, AD-25).
 * Lengths are measured in code points, like `giftInputSchema`, so an emoji is
 * one character and not two; `baseline` exempts an untouched stored value.
 */
export function validateGiftForm(
  input: {
    title: string;
    description: string;
    link: string;
    price: string;
  },
  baseline?: GiftFormBaseline,
): GiftFormErrors {
  const errors: GiftFormErrors = {};
  const title = input.title.trim();
  const description = input.description.trim();
  const link = input.link.trim();

  if (title === "") {
    errors.title = true;
  } else if (!unchanged(title, baseline?.title) && textLength(title) > GIFT_TITLE_MAX) {
    errors.title = true;
  }

  if (
    !unchanged(description, baseline?.description) &&
    textLength(description) > GIFT_DESCRIPTION_MAX
  ) {
    errors.description = true;
  }

  if (link !== "" && !unchanged(link, baseline?.link)) {
    if (textLength(link) > GIFT_LINK_URL_MAX) errors.link = true;
    else if (!isHttpUrl(link)) errors.link = true;
  }

  if (parsePriceToMinor(input.price) === "invalid") errors.price = true;
  return errors;
}

export function firstErrorField(errors: GiftFormErrors): GiftFormField | null {
  return FIELD_ORDER.find((field) => errors[field] === true) ?? null;
}

/**
 * `ActionError.field` uses the `giftInputSchema` names; the form shows
 * `priceAmount`/`priceCurrency` at the price field, `linkUrl` at the link, and
 * every `tags` / `tags.N` entry at the tag picker. `null` means the form has no
 * place for the error, so the screen shows it above the submit button instead.
 */
export function serverErrorField(field: string | undefined): GiftFormField | null {
  if (field === "tags" || field?.startsWith("tags.") === true) return "tags";
  switch (field) {
    case "title":
      return "title";
    case "description":
      return "description";
    case "price":
    case "priceAmount":
    case "priceCurrency":
      return "price";
    case "link":
    case "linkUrl":
      return "link";
    case "visibility":
      return "visibility";
    case "quantity":
      return "quantity";
    default:
      return null;
  }
}

/**
 * The selected tag a `tags.N` / `tags.N.text` / `tags.N.catalogId` server error
 * points at, or `null` for the group-level message (Q-09).
 *
 * `N` counts the tags of the request body, whose order the form preserves when
 * it passes `GiftFormValues.tags` to the screen (`giftTagInputs` in
 * `apps/mobile/app/(app)/gifts/new.tsx`). `submitted` is that order from the
 * last actual submit: mapping through it, instead of the current position,
 * keeps the error on the right tag after the owner removes or re-adds chips. A
 * missing tag — removed since the submit, or an index the request never had —
 * has nothing to point at, so the group keeps the message and no other chip is
 * blamed.
 */
export function tagErrorKey(
  field: string | undefined,
  submitted: readonly string[],
  selected: readonly string[],
): string | null {
  const match = /^tags\.(\d+)(?:\.|$)/.exec(field ?? "");
  if (match === null) return null;
  const key = submitted[Number(match[1])];
  if (key === undefined) return null;
  return selected.includes(key) ? key : null;
}

/**
 * Where the copy for a field error lives: a dedicated `app.giftForm.error.*`
 * key, or the shared validation sentence when the form has no wording of its
 * own (`visibility`). `quantity` gets its own sentence because the realistic
 * server rejection is a frozen type, not malformed input.
 */
export type GiftFormErrorCopy =
  | { catalog: "giftForm"; key: string; values?: { max: number } }
  | { catalog: "common"; key: string };

/**
 * Current values a copy depends on beyond the field itself: a server rejection
 * of the title reads as "too long" when the text already exceeds `GIFT_TITLE_MAX`,
 * and as "required" otherwise (the client rule only rejects an empty title). The
 * link is worded the same way: too long, or not a URL. Both counts are in code
 * points, so an emoji is one character.
 */
export type GiftFormErrorContext = {
  /** The title as typed; trimmed before the length check. */
  title?: string;
  /** The link as typed; trimmed before the length check. */
  link?: string;
  /** The custom tag problem behind a `tags` error, if any. */
  tagIssue?: CustomTagIssue | null;
  /** The server field behind a `tags` error, e.g. `tags.0.catalogId`. */
  tagServerField?: string;
};

export function fieldErrorCopy(
  field: GiftFormField,
  context: GiftFormErrorContext = {},
): GiftFormErrorCopy {
  switch (field) {
    case "title":
      return textLength((context.title ?? "").trim()) > GIFT_TITLE_MAX
        ? { catalog: "giftForm", key: "error.titleTooLong", values: { max: GIFT_TITLE_MAX } }
        : { catalog: "giftForm", key: "error.titleRequired" };
    case "description":
      return {
        catalog: "giftForm",
        key: "error.descriptionTooLong",
        values: { max: GIFT_DESCRIPTION_MAX },
      };
    case "price":
      return { catalog: "giftForm", key: "error.priceInvalid" };
    case "link":
      return textLength((context.link ?? "").trim()) > GIFT_LINK_URL_MAX
        ? { catalog: "giftForm", key: "error.linkTooLong", values: { max: GIFT_LINK_URL_MAX } }
        : { catalog: "giftForm", key: "error.linkInvalid" };
    case "visibility":
      return { catalog: "common", key: "errors.code.VALIDATION" };
    case "quantity":
      // The realistic rejection is a wish that became non-OPEN during the edit:
      // a generic "check your input" would ask for a change the server forbids.
      return { catalog: "giftForm", key: "error.quantityLocked" };
    case "tags":
      if (context.tagIssue === "tooLong")
        return { catalog: "giftForm", key: "error.tagTooLong", values: { max: GIFT_TAG_TEXT_MAX } };
      if (context.tagIssue === "duplicate")
        return { catalog: "giftForm", key: "error.tagDuplicate" };
      if (context.tagIssue === "empty")
        return { catalog: "giftForm", key: "error.tagEmpty" };
      if (context.tagIssue === "invalid")
        return { catalog: "giftForm", key: "error.tagInvalid" };
      if (context.tagServerField?.endsWith(".catalogId") === true)
        return { catalog: "giftForm", key: "error.tagUnavailable" };
      return {
        catalog: "giftForm",
        key: "error.tags",
        values: { max: GIFT_TAG_TEXT_MAX },
      };
  }
}
