import { z } from "zod";
import {
  CURRENCIES,
  QUANTITIES,
  RESERVATION_PHASES,
  VISIBILITIES,
} from "./enums";
import { textLength } from "./text";

/**
 * Create/edit body of a gift (Story 2.2, FR-10). The spec fixes no lengths, so
 * these caps only keep a card readable: a title is shown on two lines, a
 * description is a note, not an article.
 *
 * Units: Zod 4 measures `max()` in Unicode code points, while the `maxLength`
 * attribute of both clients measures UTF-16 units. Text outside the BMP (an
 * emoji) is therefore one code point for the schema and two units for the field,
 * so a `maxLength` would cut a value this schema accepts — the form does not use
 * one and reports the length itself, in this same unit, via {@link textLength}.
 *
 * Exported because the gift form repeats the same numbers in its own checks and
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
 * Unicode code points — the unit of PostgreSQL `VARCHAR(30)` and of
 * {@link textLength}, where an emoji outside the BMP is one character but two JS
 * units. The cap is checked by an explicit `refine` below, so the unit stays
 * written down here and does not depend on how the library measures a string.
 */
export const GIFT_TAG_TEXT_MAX = 30;

const httpUrlSchema = z.url({ protocol: /^https?$/ });

/** Empty form inputs arrive as `""`; they mean "no value", not an invalid one. */
function blankToNull(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? null : value;
}

/**
 * PostgreSQL cannot store `U+0000` in `text`/`varchar`, so a body carrying it
 * would pass the length rules and fail only on insert — as a database error and
 * a 500 instead of a VALIDATION answer (epic-2 QA report, D1). Every text of the
 * gift body goes through this one predicate, so a field cannot be forgotten:
 * the title, the description, the link and a fixed tag id.
 */
function hasNoNul(value: string): boolean {
  return !value.includes("\u0000");
}

const NUL_MESSAGE = "Text cannot contain NUL";

// Per-field rules shared by the create and the edit bodies, so an edit cannot
// drift from what creation accepts. The optionality is applied per body.
const titleFieldSchema = z
  .string()
  .trim()
  .min(1)
  .max(GIFT_TITLE_MAX)
  .refine(hasNoNul, { message: NUL_MESSAGE });
const descriptionFieldSchema = z.preprocess(
  blankToNull,
  z
    .string()
    .trim()
    .max(GIFT_DESCRIPTION_MAX)
    .refine(hasNoNul, { message: NUL_MESSAGE })
    .nullable()
    .optional(),
);
const priceAmountFieldSchema = z.number().int().min(0).max(GIFT_PRICE_AMOUNT_MAX).nullable().optional();
const priceCurrencyFieldSchema = z.enum(CURRENCIES).nullable().optional();
const linkUrlFieldSchema = z.preprocess(
  blankToNull,
  z
    .string()
    .trim()
    .max(GIFT_LINK_URL_MAX)
    .refine(hasNoNul, { message: NUL_MESSAGE })
    .pipe(httpUrlSchema)
    .nullable()
    .optional(),
);
const visibilityFieldSchema = z.enum(VISIBILITIES);
const quantityFieldSchema = z.enum(QUANTITIES);

const CALENDAR_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A real Gregorian day (`YYYY-MM-DD`), not `2026-02-31` and not a datetime. */
export function isCalendarDay(value: string): boolean {
  const match = CALENDAR_DAY.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Story 2.6: an optional calendar day (`YYYY-MM-DD`). Empty form text means
 * "no date". Impossible days (`2026-02-31`) are rejected here; "before today"
 * is the use-case's job, because it depends on the owner's time zone.
 */
const expiresOnFieldSchema = z.preprocess(
  blankToNull,
  z
    .string()
    .regex(CALENDAR_DAY)
    .refine(isCalendarDay, { message: "expiresOn must be a calendar day" })
    .nullable()
    .optional(),
);

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
  .refine(hasNoNul, {
    message: "A custom tag cannot contain NUL",
  })
  .refine(function fitsTagText(value) {
    return textLength(value) <= GIFT_TAG_TEXT_MAX;
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
  z.strictObject({
    catalogId: z
      .string()
      .trim()
      .min(1)
      .refine(hasNoNul, { message: NUL_MESSAGE }),
  }),
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
    expiresOn: expiresOnFieldSchema,
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
      expiresOn: value.expiresOn ?? null,
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
  /** A calendar day, or `null` to clear. Absent keeps the stored date (Story 2.6). */
  expiresOn?: string | null;
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
 * keys that came in, so the use-case never overwrites a field the owner did not
 * touch — in particular `visibility` gets no default here.
 *
 * AD-25 on an edit: an amount and its currency are a pair. Clearing the amount
 * clears both; a set amount with an explicit `null` currency is rejected, since
 * a price never exists without a currency (epic-2 QA report, D2). An amount
 * sent without the currency key leaves the currency to `updateGift`, which
 * keeps the stored one and falls back to `USD` only when the wish had no price
 * (epic-2 QA report, Н1) — this schema must not invent `USD` here.
 *
 * Story 2.5: `quantity` is a closed enum with no `null` form; the use-case
 * writes a changed value only while the gift is `OPEN`, exactly like
 * `visibility`.
 */
/**
 * Preflight of a visibility change on the owner's wish (CLE-82/S23.2, FR-10 ред.
 * 2026-11-11). The query names the value the owner wants to pick:
 * `GET /api/v1/me/gifts/:id/visibility?visibility=FRIENDS`.
 */
export const giftVisibilityPreviewQuerySchema = z.strictObject({
  visibility: z.enum(VISIBILITIES),
});

export type GiftVisibilityPreviewQuery = z.infer<typeof giftVisibilityPreviewQuerySchema>;

/**
 * The preflight answer. D-49: the owner never learns that a reservation exists,
 * so `wouldCancelReservation` is always `false` and the client's warning before
 * a visibility change never depends on a reservation. The key stays for older
 * clients; the write repeats the AD-7 release rule on its own, so the value is
 * informational only.
 */
export const giftVisibilityPreviewSchema = z.strictObject({
  wouldCancelReservation: z.boolean(),
});

export type GiftVisibilityPreview = z.infer<typeof giftVisibilityPreviewSchema>;

export const giftUpdateSchema = z
  .strictObject({
    title: titleFieldSchema.optional(),
    description: descriptionFieldSchema,
    priceAmount: priceAmountFieldSchema,
    priceCurrency: priceCurrencyFieldSchema,
    linkUrl: linkUrlFieldSchema,
    visibility: visibilityFieldSchema.optional(),
    quantity: quantityFieldSchema.optional(),
    expiresOn: expiresOnFieldSchema,
    tags: giftTagListSchema.optional(),
  })
  .refine(function hasAnyGiftUpdateField(value) {
    return Object.values(value).some((field) => field !== undefined);
  }, {
    message: "At least one field is required",
  })
  .refine(function keepsAmountWithCurrency(value) {
    // A set amount carries a currency: `null` here would store an amount that
    // no card can show. An absent key is the use-case's business (stored
    // currency or `USD`), so only an explicit `null` is rejected.
    if (value.priceAmount === undefined || value.priceAmount === null) return true;
    return value.priceCurrency !== null;
  }, {
    message: "An amount requires a currency",
    path: ["priceCurrency"],
  })
  .transform(function toGiftUpdate(value): GiftUpdate {
    const update: GiftUpdate = {};

    if (value.title !== undefined) update.title = value.title;
    if (value.description !== undefined) update.description = value.description;
    if (value.linkUrl !== undefined) update.linkUrl = value.linkUrl;
    if (value.visibility !== undefined) update.visibility = value.visibility;
    if (value.quantity !== undefined) update.quantity = value.quantity;
    if (value.expiresOn !== undefined) update.expiresOn = value.expiresOn;
    if (value.tags !== undefined) update.tags = value.tags;

    if (value.priceAmount !== undefined) {
      update.priceAmount = value.priceAmount;
      if (value.priceAmount === null) {
        // AD-25: no amount means no price, so the currency is cleared with it.
        update.priceCurrency = null;
      } else if (value.priceCurrency !== undefined) {
        // The refine above guarantees the explicit currency is not `null`.
        update.priceCurrency = value.priceCurrency;
      }
      // Without the key the use-case pairs the amount with the stored currency,
      // or with `USD` when the wish had none (AD-25, Н1).
    } else if (value.priceCurrency !== undefined) {
      // No amount in the body: the use-case combines this currency with the stored amount.
      update.priceCurrency = value.priceCurrency;
    }

    return update;
  });

/**
 * Story 5.1 (AD-9): body of `POST /api/v1/gifts/:id/reserve`.
 *
 * CLE-124/D-49: the owner never learns that a wish is reserved, so there is no
 * «Показать владельцу» switch anymore. The key stays optional and is ignored by
 * the server, so an older app version can still send it without breaking.
 */
export const giftReserveBodySchema = z.strictObject({
  dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  holderVisibleToOwner: z.boolean().optional(),
  holderVisibleToOthers: z.boolean(),
});

export type GiftReserveBody = z.infer<typeof giftReserveBodySchema>;

/**
 * A real calendar day on the wire (Story 5.5): the holder's `dueAt` and the
 * day an extension picks. Unlike {@link giftReserveBodySchema} — which only
 * checks the shape — an impossible day such as `2026-02-31` is refused here.
 */
const calendarDayFieldSchema = z
  .string()
  .regex(CALENDAR_DAY)
  .refine(isCalendarDay, { message: "must be a calendar day" });

/**
 * Story 5.5 (FR-25, A-14, AD-7/AD-12): one card of «Мои брони». This is the
 * whole closed set a holder learns about a reservation they made, and it does
 * not depend on the wish still being visible: after an unfriend or a block the
 * card stays and the other wishes of the owner never join it. No price, tags,
 * description, link, owner name, `visibility`, `reservationTimeZone` or list
 * token, so the card cannot become a second read of the wishlist.
 *
 * `status` is the literal `"RESERVED"` on purpose: a future `CLOSED` row in this
 * list has to widen the contract explicitly instead of slipping through.
 * `dueAt` is the calendar day the holder picked (not an instant); `phase` and
 * `bought` let the client tell available actions from the ones of Story 5.6/5.7,
 * and `canOpenGift` is the server's answer whether the detail is still reachable
 * (it never explains why not).
 */
export const reservationCardSchema = z.strictObject({
  giftId: z.string(),
  /** The title as it was at the moment of reserving; a rename never rewrites it. */
  titleSnapshot: z.string(),
  status: z.literal("RESERVED"),
  ownerNick: z.string(),
  dueAt: calendarDayFieldSchema,
  phase: z.enum(RESERVATION_PHASES),
  bought: z.boolean(),
  holderVisibleToOwner: z.boolean(),
  holderVisibleToOthers: z.boolean(),
  canOpenGift: z.boolean(),
});

export type ReservationCard = z.infer<typeof reservationCardSchema>;

/** Story 5.5: `GET /api/v1/me/reservations` — the holder's cards and nothing else. */
export const reservationListSchema = z.strictObject({
  reservations: z.array(reservationCardSchema),
});

export type ReservationList = z.infer<typeof reservationListSchema>;

/**
 * Story 5.5 (FR-25, FR-29–FR-31), CLE-124/S9b-2: one action per request on
 * `PATCH /api/v1/me/reservations/:giftId` — `extend { dueOn }`, `bought { value }`,
 * `visibility { holderVisibleToOthers }` or `given`. A closed discriminated
 * union, so two actions in one body, an extra key or an empty `action` are
 * `VALIDATION`; the server reads `firstIssueField` to name the field. Removing a
 * reservation stays with `DELETE /api/v1/gifts/:id/reserve` (Story 5.2) and is
 * not listed here.
 */
export const reservationActionBodySchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("extend"),
    dueOn: calendarDayFieldSchema,
  }),
  z.strictObject({
    action: z.literal("bought"),
    value: z.boolean(),
  }),
  /**
   * CLE-124/S9b-2 (Story 5.7): «Подарил». Only the holder of a live reservation
   * may mark it; the wish keeps its status. A repeat in `GIVEN` is a success.
   */
  z.strictObject({
    action: z.literal("given"),
  }),
  z.strictObject({
    action: z.literal("visibility"),
    /** CLE-124/D-49: ignored by the server; kept optional for older clients. */
    holderVisibleToOwner: z.boolean().optional(),
    holderVisibleToOthers: z.boolean(),
  }),
]);

export type ReservationActionBody = z.infer<typeof reservationActionBodySchema>;

/**
 * Story 2.6: the owner puts an archived wish back. An absent or empty date
 * clears `expiresOn`. "Before today" is checked by `restoreFromArchive`.
 */
export const giftRestoreSchema = z
  .strictObject({
    expiresOn: expiresOnFieldSchema,
  })
  .transform(function toGiftRestore(value) {
    return { expiresOn: value.expiresOn ?? null };
  });

export type GiftRestore = z.infer<typeof giftRestoreSchema>;
