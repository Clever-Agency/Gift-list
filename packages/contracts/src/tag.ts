import { z } from "zod";
import { SUPPORTED_LOCALES, type SupportedLocale } from "./i18n/locale";

/**
 * Fixed tag catalog read (Story 2.5, AD-22, AD-27).
 *
 * The server resolves `label` from the tag's `labels` object by the request
 * language, so the client never keeps fixed-tag captions. `slug` stays in the
 * answer because it is the immutable catalog key; `id` is what a gift stores
 * as `catalogId` (AD-12).
 *
 * Strict on purpose: moderation flags, aggregate state and custom text are not
 * part of the catalog contract and must not leak into it.
 */
export const tagCatalogItemSchema = z.strictObject({
  id: z.string().min(1),
  slug: z.string().min(1),
  label: z.string().min(1),
});

export type TagCatalogItem = z.infer<typeof tagCatalogItemSchema>;

/**
 * `GET /api/v1/tags` data. `tags` is ordered by `slug` ascending in Unicode
 * code units (the server sorts it); clients must not re-sort. The answer depends
 * on the request language, so a client refetches it after a language change and
 * must not keep one language's labels.
 */
export const tagCatalogSchema = z.strictObject({
  tags: z.array(tagCatalogItemSchema),
});

export type TagCatalog = z.infer<typeof tagCatalogSchema>;

/**
 * ADMIN moderation of custom tag texts (Story 10.2, AD-22, AD-27).
 *
 * A decision is keyed by the normalized text — trim, collapsed spaces and lower
 * case — so "Айфон", "айфон" and "  айфон " are one queue line. The server
 * normalizes; the queue line carries the key (`normalizedText`), one example
 * spelling and how many wishes use it. No author, wish id or gift title ever
 * belongs here: AD-22 keeps the moderator away from the people who wrote tags.
 */
export const TAG_SLUG_MAX = 40;
/** A caption of one catalog tag, per language (AD-27). Same cap as custom text. */
export const TAG_LABEL_MAX = 40;

/** `EXPERIENCE.md`: `slug` is Latin letters, digits and hyphens, 1–40, never changes. */
export const tagSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(TAG_SLUG_MAX)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "A slug is lower-case Latin letters, digits and single hyphens",
  });

const tagLabelSchema = z
  .string()
  .trim()
  .min(1)
  .max(TAG_LABEL_MAX)
  .refine(function hasNoNul(value) {
    return !value.includes("\u0000");
  }, { message: "A label cannot contain NUL" });

/** AD-27: every language of `SUPPORTED_LOCALES` gets a non-empty caption. */
export type TagLabels = { [Locale in SupportedLocale]: string };

const tagLabelsShape = Object.fromEntries(
  SUPPORTED_LOCALES.map(function labelField(locale) {
    return [locale, tagLabelSchema];
  }),
);

/**
 * AD-27: a catalog tag carries one caption per supported language, all of them
 * non-empty, and nothing else. The object is strict: an unknown language key is
 * a typo, not a future label.
 */
export const tagLabelsSchema = z.strictObject(tagLabelsShape) as unknown as z.ZodType<TagLabels>;

/**
 * One line of the `/admin/tags` queue. `usageCount` is the number of distinct
 * wishes with that text; `sampleText` is the most frequent spelling as typed.
 */
export const customTagQueueItemSchema = z.strictObject({
  normalizedText: z.string().trim().min(1).max(TAG_LABEL_MAX),
  sampleText: z.string().trim().min(1).max(TAG_LABEL_MAX),
  usageCount: z.number().int().positive(),
});

export type CustomTagQueueItem = z.infer<typeof customTagQueueItemSchema>;

const normalizedTextSchema = z
  .string()
  .trim()
  .min(1)
  .max(TAG_LABEL_MAX)
  .refine(function hasNoNul(value) {
    return !value.includes("\u0000");
  }, { message: "A tag text cannot contain NUL" });

/**
 * Approval of one queue line (Story 10.2). Either a new catalog tag (`slug`
 * plus a caption for every supported language) or an existing catalog tag
 * (`tagId`) — never both. `normalizedText` is the queue key the moderator saw,
 * so a stale screen cannot approve a different text.
 */
export const customTagApprovalSchema = z.discriminatedUnion("mode", [
  z.strictObject({
    mode: z.literal("new"),
    normalizedText: normalizedTextSchema,
    slug: tagSlugSchema,
    labels: tagLabelsSchema,
  }),
  z.strictObject({
    mode: z.literal("existing"),
    normalizedText: normalizedTextSchema,
    tagId: z.string().trim().min(1),
  }),
]);

export type CustomTagApproval = z.infer<typeof customTagApprovalSchema>;

/** Rejection of one queue line: the text stays on the wishes, out of aggregates. */
export const customTagRejectionSchema = z.strictObject({
  normalizedText: normalizedTextSchema,
});

export type CustomTagRejection = z.infer<typeof customTagRejectionSchema>;
