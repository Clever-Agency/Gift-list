// Editorial collections of gift ideas (CLE-143, Story 10.1, AD-22, FR-49,
// D-32). The editor fills them by hand in `/admin`; the app shows only the
// published ones. Rules only: no React, Prisma or env.
//
// The field caps are the wish caps (Story 2.2): `title` is 120 code points, a
// description 2000 and a link 2048, and a link/image is an `http(s)` URL. They
// come from `gift.ts` so a collection cannot drift from a wish.
import { z } from "zod";
import {
  GIFT_DESCRIPTION_MAX,
  GIFT_LINK_URL_MAX,
  GIFT_TITLE_MAX,
  giftDescriptionSchema,
  giftLinkUrlSchema,
  giftTitleSchema,
} from "./gift";

/**
 * Story 10.1: a cover and an idea image are URLs only — the admin panel uploads
 * no files. The rule is the wish-link rule: trimmed, at most
 * {@link GIFT_LINK_URL_MAX} characters and an `http(s)` URL; an empty form input
 * means "no image".
 */
const imageUrlSchema = giftLinkUrlSchema;

/**
 * Create/edit body of a collection in `/admin` (Story 10.1). `title` is
 * required; the description and the cover URL are optional and an empty string
 * arrives as "no value". Strict on purpose: `publishedAt` is never set by a
 * client — publishing is its own action.
 */
export const editorialCollectionInputSchema = z.strictObject({
  title: giftTitleSchema,
  description: giftDescriptionSchema,
  coverImageUrl: imageUrlSchema,
});

export type EditorialCollectionInput = z.infer<typeof editorialCollectionInputSchema>;

/**
 * Create/edit body of one idea inside a collection (Story 10.1). Same title and
 * description caps as a wish; the link and the image are optional URLs. The
 * order is not here: it is set by {@link editorialItemOrderSchema} and by the
 * append position of a new idea.
 *
 * Q-14: there is no blogger field. The admin form warns that blogger links must
 * not be published until the legal checklist is closed.
 */
export const editorialItemInputSchema = z.strictObject({
  title: giftTitleSchema,
  description: giftDescriptionSchema,
  linkUrl: giftLinkUrlSchema,
  imageUrl: imageUrlSchema,
});

export type EditorialItemInput = z.infer<typeof editorialItemInputSchema>;

/**
 * Reorder body of one collection (Story 10.1): the full list of idea ids in
 * their new order. The server refuses a list that is not exactly the stored set
 * — a missing id would silently drop an idea from the order and an unknown one
 * would move somebody else's row.
 */
export const editorialItemOrderSchema = z
  .strictObject({
    itemIds: z.array(z.string().trim().min(1)).min(1),
  })
  .superRefine(function hasNoDuplicateItems(value, context) {
    if (new Set(value.itemIds).size !== value.itemIds.length) {
      context.addIssue({
        code: "custom",
        path: ["itemIds"],
        message: "An idea appears twice in the order",
      });
    }
  });

export type EditorialItemOrder = z.infer<typeof editorialItemOrderSchema>;

/**
 * One idea as the app gets it (Story 10.1): only the fields the screen shows.
 * `position` stays in the admin answer: the app receives the ideas already in
 * their order. No timestamps and no author, like every AD-12 answer.
 */
export const editorialItemSchema = z.strictObject({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  linkUrl: z.string().nullable(),
  imageUrl: z.string().nullable(),
});

export type EditorialItem = z.infer<typeof editorialItemSchema>;

/**
 * One card of the app's «Подборки» screen (Story 10.1): the cover, the title
 * and the number of ideas. `publishedAt` and the draft state are not here — the
 * app reads published collections only.
 */
export const editorialCollectionSummarySchema = z.strictObject({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  coverImageUrl: z.string().nullable(),
  itemCount: z.number().int().nonnegative(),
});

export type EditorialCollectionSummary = z.infer<typeof editorialCollectionSummarySchema>;

/**
 * The app's «Подборки» answer (Story 10.1): the published cards only. The list is
 * a named key, like the wishlist gifts and the tag catalog, so an empty answer is
 * still a closed object the client can check.
 */
export const editorialCollectionListSchema = z.strictObject({
  collections: z.array(editorialCollectionSummarySchema),
});

export type EditorialCollectionList = z.infer<typeof editorialCollectionListSchema>;

/** The app's one collection screen: the card fields plus its ideas in order. */
export const editorialCollectionDetailSchema = z.strictObject({
  ...editorialCollectionSummarySchema.shape,
  items: z.array(editorialItemSchema),
});

export type EditorialCollectionDetail = z.infer<typeof editorialCollectionDetailSchema>;

/**
 * One row of the `/admin` table (Story 10.1): the same counts as the app plus
 * the publication state and the moment the collection last changed. Both are
 * ISO instants (`updatedAt` is always present); the page formats them with
 * `formatDate()`.
 */
export const editorialCollectionAdminSummarySchema = z.strictObject({
  ...editorialCollectionSummarySchema.shape,
  publishedAt: z.string().nullable(),
  updatedAt: z.string(),
});

export type EditorialCollectionAdminSummary = z.infer<typeof editorialCollectionAdminSummarySchema>;

/**
 * One idea in the admin panel: the app fields plus `position`, so the editor can
 * order the list and the form can show the current place.
 */
export const editorialItemAdminSchema = z.strictObject({
  ...editorialItemSchema.shape,
  position: z.number().int().nonnegative(),
});

export type EditorialItemAdmin = z.infer<typeof editorialItemAdminSchema>;

/** One collection in the admin panel: the table row plus its ideas. */
export const editorialCollectionAdminDetailSchema = z.strictObject({
  ...editorialCollectionAdminSummarySchema.shape,
  items: z.array(editorialItemAdminSchema),
});

export type EditorialCollectionAdminDetail = z.infer<
  typeof editorialCollectionAdminDetailSchema
>;

/**
 * The re-exported caps, so an admin form can show a counter without importing
 * the wish module. Values are the wish values on purpose (Story 10.1).
 */
export const EDITORIAL_TITLE_MAX = GIFT_TITLE_MAX;
export const EDITORIAL_DESCRIPTION_MAX = GIFT_DESCRIPTION_MAX;
export const EDITORIAL_LINK_URL_MAX = GIFT_LINK_URL_MAX;
