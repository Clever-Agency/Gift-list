import { z } from "zod";
import { CURRENCIES, QUANTITIES, VISIBILITIES } from "./enums";

/**
 * Create/edit body of a gift (Story 2.2, FR-10). The spec fixes no lengths, so
 * these caps only keep a card readable: a title is shown on two lines, a
 * description is a note, not an article.
 */
const TITLE_MAX = 120;
const DESCRIPTION_MAX = 2000;
/** Prisma `Int` is signed 32-bit; the amount is minor units (AD-25). */
const PRICE_AMOUNT_MAX = 2_147_483_647;
/** Same ceiling as `safeNextPath`; links are free-form `text` in the DB. */
const LINK_URL_MAX = 2048;

const httpUrlSchema = z.url({ protocol: /^https?$/ });

/** Empty form inputs arrive as `""`; they mean "no value", not an invalid one. */
function blankToNull(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? null : value;
}

// Per-field rules shared by the create and the edit bodies, so an edit cannot
// drift from what creation accepts. The optionality is applied per body.
const titleFieldSchema = z.string().trim().min(1).max(TITLE_MAX);
const descriptionFieldSchema = z.preprocess(
  blankToNull,
  z.string().trim().max(DESCRIPTION_MAX).nullable().optional(),
);
const priceAmountFieldSchema = z.number().int().min(0).max(PRICE_AMOUNT_MAX).nullable().optional();
const priceCurrencyFieldSchema = z.enum(CURRENCIES).nullable().optional();
const linkUrlFieldSchema = z.preprocess(
  blankToNull,
  z.string().trim().max(LINK_URL_MAX).pipe(httpUrlSchema).nullable().optional(),
);
const visibilityFieldSchema = z.enum(VISIBILITIES);
const quantityFieldSchema = z.enum(QUANTITIES);

/**
 * Story 2.5/D-25: a new gift is `SINGLE` unless the owner chooses otherwise.
 * The client imports this constant instead of repeating `"SINGLE"`, so the
 * default lives in the contract only once.
 */
export const DEFAULT_QUANTITY = "SINGLE" satisfies (typeof QUANTITIES)[number];

/**
 * AD-25: the price is optional. When the amount is set and no currency was
 * chosen, the currency is `USD`; without an amount the currency is `null`.
 * AD-17/ARCH-A17: a new gift is visible to everyone (`PUBLIC`) by default.
 * Story 2.5/D-25: a gift is `SINGLE` by default; `UNLIMITED` is the explicit
 * "can be given any number of times" choice.
 */
export const giftInputSchema = z
  .strictObject({
    title: titleFieldSchema,
    description: descriptionFieldSchema,
    priceAmount: priceAmountFieldSchema,
    priceCurrency: priceCurrencyFieldSchema,
    linkUrl: linkUrlFieldSchema,
    visibility: visibilityFieldSchema.default("PUBLIC"),
    quantity: quantityFieldSchema.default(DEFAULT_QUANTITY),
  })
  .transform(function toGiftInput(value) {
    const priceAmount = value.priceAmount ?? null;
    return {
      title: value.title,
      description: value.description ?? null,
      priceAmount,
      priceCurrency: priceAmount === null ? null : (value.priceCurrency ?? "USD"),
      linkUrl: value.linkUrl ?? null,
      visibility: value.visibility,
      quantity: value.quantity,
    };
  });

export type GiftInput = z.infer<typeof giftInputSchema>;

/**
 * The body a client may send to create a gift: the schema's input side, where
 * `visibility` and `quantity` are optional and the contract fills their defaults.
 * Screens build this draft; the defaults come from the contract, so a caller
 * does not hard-code them.
 */
export type GiftInputDraft = z.input<typeof giftInputSchema>;

/** Edit body of an own gift (Story 2.2, FR-10). */
export type GiftUpdate = {
  title?: string;
  description?: string | null;
  priceAmount?: number | null;
  priceCurrency?: (typeof CURRENCIES)[number] | null;
  linkUrl?: string | null;
  visibility?: (typeof VISIBILITIES)[number];
  quantity?: (typeof QUANTITIES)[number];
};

/**
 * AD-1: the edit reaches the same use-case as the create, so the per-field
 * rules are identical. The body is a partial: an absent field keeps the stored
 * value, `null` clears description, link and price. The output carries only the
 * keys that came in (plus the currency implied by a given amount), so the
 * use-case never overwrites a field the owner did not touch — in particular
 * `visibility` gets no default here.
 *
 * Story 2.5: `quantity` is a closed enum with no `null` form; the use-case
 * writes a changed value only while the gift is `OPEN`, exactly like
 * `visibility`.
 */
export const giftUpdateSchema = z
  .strictObject({
    title: titleFieldSchema.optional(),
    description: descriptionFieldSchema,
    priceAmount: priceAmountFieldSchema,
    priceCurrency: priceCurrencyFieldSchema,
    linkUrl: linkUrlFieldSchema,
    visibility: visibilityFieldSchema.optional(),
    quantity: quantityFieldSchema.optional(),
  })
  .refine(function hasAnyGiftUpdateField(value) {
    return Object.values(value).some((field) => field !== undefined);
  }, {
    message: "At least one field is required",
  })
  .transform(function toGiftUpdate(value): GiftUpdate {
    const update: GiftUpdate = {};

    if (value.title !== undefined) update.title = value.title;
    if (value.description !== undefined) update.description = value.description;
    if (value.linkUrl !== undefined) update.linkUrl = value.linkUrl;
    if (value.visibility !== undefined) update.visibility = value.visibility;
    if (value.quantity !== undefined) update.quantity = value.quantity;

    if (value.priceAmount !== undefined) {
      update.priceAmount = value.priceAmount;
      // AD-25: a set amount always carries a currency, a cleared amount clears both.
      update.priceCurrency = value.priceAmount === null ? null : (value.priceCurrency ?? "USD");
    } else if (value.priceCurrency !== undefined) {
      // No amount in the body: the use-case combines this currency with the stored amount.
      update.priceCurrency = value.priceCurrency;
    }

    return update;
  });
