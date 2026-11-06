/**
 * Client rules of the gift form (Story 2.2, subtask 17) and the mapping of a
 * server `ActionError.field` onto the field that shows it. Pure on purpose: the
 * component stays presentation and the rules are unit-tested directly.
 *
 * `EXPERIENCE.md` → Ошибки форм and → Accessibility Floor: nothing is validated
 * while typing; on submit the first error is announced and stays under its
 * field until that field is edited.
 */
import { GIFT_TAG_TEXT_MAX } from "@gift-list/contracts";
import { parsePriceToMinor } from "@/ui/gift-price";
import type { CustomTagIssue } from "@/ui/gift-form-tags";

/** Same caps as `giftInputSchema` in `packages/contracts/src/gift.ts`. */
export const TITLE_MAX = 120;
export const DESCRIPTION_MAX = 2000;
export const LINK_MAX = 2048;

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

/** Runs on submit only. Empty description and link are valid (D-25, AD-25). */
export function validateGiftForm(input: {
  title: string;
  link: string;
  price: string;
}): GiftFormErrors {
  const errors: GiftFormErrors = {};
  if (input.title.trim() === "") errors.title = true;
  if (input.link.trim() !== "" && !isHttpUrl(input.link)) errors.link = true;
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
 * of the title reads as "too long" when the text already exceeds `TITLE_MAX`,
 * and as "required" otherwise (the client rule only rejects an empty title).
 */
export type GiftFormErrorContext = {
  /** The title as typed; trimmed before the length check. */
  title?: string;
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
      return (context.title ?? "").trim().length > TITLE_MAX
        ? { catalog: "giftForm", key: "error.titleTooLong", values: { max: TITLE_MAX } }
        : { catalog: "giftForm", key: "error.titleRequired" };
    case "description":
      return {
        catalog: "giftForm",
        key: "error.descriptionTooLong",
        values: { max: DESCRIPTION_MAX },
      };
    case "price":
      return { catalog: "giftForm", key: "error.priceInvalid" };
    case "link":
      return { catalog: "giftForm", key: "error.linkInvalid" };
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
