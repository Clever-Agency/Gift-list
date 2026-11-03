/**
 * Client rules of the gift form (Story 2.2, subtask 17) and the mapping of a
 * server `ActionError.field` onto the field that shows it. Pure on purpose: the
 * component stays presentation and the rules are unit-tested directly.
 *
 * `EXPERIENCE.md` → Ошибки форм and → Accessibility Floor: nothing is validated
 * while typing; on submit the first error is announced and stays under its
 * field until that field is edited.
 */
import { parsePriceToMinor } from "@/ui/gift-price";

/** Same caps as `giftInputSchema` in `packages/contracts/src/gift.ts`. */
export const TITLE_MAX = 120;
export const DESCRIPTION_MAX = 2000;
export const LINK_MAX = 2048;

/** Fields that can carry an inline error; the currency rides with the price. */
export type GiftFormField = "title" | "description" | "price" | "link" | "visibility";

export type GiftFormErrors = Partial<Record<GiftFormField, true>>;

/** Visual order of the form: the first error in it is focused and announced. */
const FIELD_ORDER = [
  "title",
  "description",
  "link",
  "price",
  "visibility",
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
 * `priceAmount`/`priceCurrency` at the price field and `linkUrl` at the link.
 * `null` means the form has no place for the error, so the screen shows it
 * above the submit button instead.
 */
export function serverErrorField(field: string | undefined): GiftFormField | null {
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
    default:
      return null;
  }
}

/**
 * Where the copy for a field error lives: a dedicated `app.giftForm.error.*`
 * key, or the shared validation sentence when the form has no wording of its
 * own (`visibility`).
 */
export type GiftFormErrorCopy =
  | { catalog: "giftForm"; key: string; values?: { max: number } }
  | { catalog: "common"; key: string };

export function fieldErrorCopy(field: GiftFormField): GiftFormErrorCopy {
  switch (field) {
    case "title":
      return { catalog: "giftForm", key: "error.titleRequired" };
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
  }
}
