import { z } from "zod";
import { CURRENCIES, VISIBILITIES } from "./enums";

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

/**
 * AD-25: the price is optional. When the amount is set and no currency was
 * chosen, the currency is `USD`; without an amount the currency is `null`.
 * AD-17/ARCH-A17: a new gift is visible to everyone (`PUBLIC`) by default.
 */
export const giftInputSchema = z
  .strictObject({
    title: z.string().trim().min(1).max(TITLE_MAX),
    description: z.preprocess(blankToNull, z.string().trim().max(DESCRIPTION_MAX).nullable().optional()),
    priceAmount: z.number().int().min(0).max(PRICE_AMOUNT_MAX).nullable().optional(),
    priceCurrency: z.enum(CURRENCIES).nullable().optional(),
    linkUrl: z.preprocess(
      blankToNull,
      z.string().trim().max(LINK_URL_MAX).pipe(httpUrlSchema).nullable().optional(),
    ),
    visibility: z.enum(VISIBILITIES).default("PUBLIC"),
  })
  .transform((value) => {
    const priceAmount = value.priceAmount ?? null;
    return {
      title: value.title,
      description: value.description ?? null,
      priceAmount,
      priceCurrency: priceAmount === null ? null : (value.priceCurrency ?? "USD"),
      linkUrl: value.linkUrl ?? null,
      visibility: value.visibility,
    };
  });

export type GiftInput = z.infer<typeof giftInputSchema>;
