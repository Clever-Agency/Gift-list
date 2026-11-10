import { z } from "zod";
import { CURRENCIES, QUANTITIES, VISIBILITIES } from "./enums";

/**
 * Create/edit body of a gift (Story 2.2, FR-10). The spec fixes no lengths, so
 * these caps only keep a card readable: a title is shown on two lines, a
 * description is a note, not an article.
 *
 * Units: Zod 4 measures `max()` in Unicode code points, while the `maxLength`
 * attribute of both clients measures UTF-16 units. Text outside the BMP (an
 * emoji) is therefore one code point for the schema and two units for the field,
 * so the form cuts first and the schema accepts what the form already limited.
 *
 * Exported because the gift form repeats the same numbers in its `maxLength` and
 * counters; it must import them from here instead of declaring its own copies.
 * The custom tag text has its own rule and unit — see {@link GIFT_TAG_TEXT_MAX}.
 */
export const GIFT_TITLE_MAX = 120;
export const GIFT_DESCRIPTION_MAX = 2000;
/** Prisma `Int` is signed 32-bit; the amount is minor units (AD-25). */
export const GIFT_PRICE_AMOUNT_MAX = 2_147_483_647;
/** Same ceiling as `safeNextPath`; links are free-form `text` in the DB. */
export const GIFT_LINK_URL_MAX = 2048;

/**
 * Story 2.5 / AD-22: custom tag text is at most 30 characters, counted in
 * Unicode code points — the unit of PostgreSQL `VARCHAR(30)` and of `[...text]`,
 * where an emoji outside the BMP is one character but two JS units. The cap is
 * checked by an explicit `refine` below, so the unit stays written down here and
 * does not depend on how the library measures a string.
 */
export const GIFT_TAG_TEXT_MAX = 30;

const httpUrlSchema = z.url({ protocol: /^https?$/ });

/** Empty form inputs arrive as `""`; they mean "no value", not an invalid one. */
function blankToNull(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? null : value;
}

// Per-field rules shared by the create and the edit bodies, so an edit cannot
// drift from what creation accepts. The optionality is applied per body.
const titleFieldSchema = z.string().trim().min(1).max(GIFT_TITLE_MAX);
const descriptionFieldSchema = z.preprocess(
  blankToNull,
  z.string().trim().max(GIFT_DESCRIPTION_MAX).nullable().optional(),
);
const priceAmountFieldSchema = z.number().int().min(0).max(GIFT_PRICE_AMOUNT_MAX).nullable().optional();
const priceCurrencyFieldSchema = z.enum(CURRENCIES).nullable().optional();
const linkUrlFieldSchema = z.preprocess(
  blankToNull,
  z.string().trim().max(GIFT_LINK_URL_MAX).pipe(httpUrlSchema).nullable().optional(),
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
 * A custom tag's text: trimmed, non-empty, at most {@link GIFT_TAG_TEXT_MAX}
 * Unicode code points. Trimming happens here so the stored row and the
 * `(giftId, customText)` uniqueness both see the same value.
 *
 * NUL is rejected: PostgreSQL cannot store `U+0000` in `text`/`varchar`, so a
 * body containing it would otherwise pass validation and fail as a database
 * error instead of a VALIDATION answer.
 */
const tagTextFieldSchema = z
  .string()
  .trim()
  .min(1)
  .refine(function hasNoNul(value) {
    return !value.includes("\u0000");
  }, {
    message: "A custom tag cannot contain NUL",
  })
  .refine(function fitsTagText(value) {
    return [...value].length <= GIFT_TAG_TEXT_MAX;
  }, {
    message: `A custom tag is at most ${GIFT_TAG_TEXT_MAX} characters`,
  });

/**
 * One tag of a gift (Story 2.5, AD-22). A fixed tag arrives as its catalog id;
 * a custom tag as its text. The two are mutually exclusive: a row carries
 * either a catalog reference or a custom text, never both and never neither.
 *
 * Strict on purpose: a client can never set `aggregateEligible` or any other
 * moderation state — fixed tags become aggregate-eligible on the server, custom
 * ones stay out until ADMIN approval (Story 10.2).
 */
export const giftTagInputSchema = z.union([
  z.strictObject({ catalogId: z.string().trim().min(1) }),
  z.strictObject({ text: tagTextFieldSchema }),
]);

export type GiftTagInput = z.infer<typeof giftTagInputSchema>;

/**
 * Tag list of a create/edit body. Duplicates are rejected, matching the
 * database uniques `(giftId, tagId)` and `(giftId, customText)`: the same
 * catalog id or the same trimmed custom text may appear once. Comparison is
 * exact (case-sensitive), because the database is byte-exact too; no
 * normalisation beyond trimming is invented here.
 */
const giftTagListSchema = z
  .array(giftTagInputSchema)
  .superRefine(function hasNoDuplicateTags(tags, context) {
    const catalogIds = new Set<string>();
    const texts = new Set<string>();
    for (const tag of tags) {
      const seen = "catalogId" in tag ? catalogIds : texts;
      const key = "catalogId" in tag ? tag.catalogId : tag.text;
      if (seen.has(key)) {
        context.addIssue({ code: "custom", message: "Duplicate tag" });
        return;
      }
      seen.add(key);
    }
  });


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
    tags: giftTagListSchema.optional(),
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
      tags: value.tags ?? [],
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
  /**
   * Full replacement of the tag set. Absent keeps the stored tags; an explicit
   * empty array clears them. Anything else replaces all rows in one transaction.
   */
  tags?: GiftTagInput[];
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
    tags: giftTagListSchema.optional(),
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
    if (value.tags !== undefined) update.tags = value.tags;

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
