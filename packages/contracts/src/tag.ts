import { z } from "zod";

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
