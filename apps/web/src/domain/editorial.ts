// AD-22 (Story 10.1, FR-49, D-32) — editorial collections. Rules only: no
// Prisma, no React/Next.js here (AD-1). The store reads and writes rows; this
// module decides what a published collection is, how a new idea joins the end
// of the order and that a reorder keeps exactly the stored set.
import type {
  EditorialCollectionAdminDetail,
  EditorialCollectionAdminSummary,
  EditorialCollectionDetail,
  EditorialCollectionSummary,
  EditorialItem,
  EditorialItemAdmin,
} from "@gift-list/contracts";

/** One stored idea, with the manual order key the app never receives. */
export type EditorialItemStored = {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly linkUrl: string | null;
  readonly imageUrl: string | null;
  readonly position: number;
};

/** One stored collection with its ideas in their stored order. */
export type EditorialCollectionStored = {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly coverImageUrl: string | null;
  readonly publishedAt: Date | null;
  readonly updatedAt: Date;
  readonly items: readonly EditorialItemStored[];
};

/** The collection columns without ideas; the list reads its count separately. */
export type EditorialCollectionRow = Omit<EditorialCollectionStored, "items">;

/**
 * Story 10.1: a collection is visible to users only after an editor published
 * it. `publishedAt = null` is a draft; a future timestamp is not published
 * either, so the read and this rule agree without trusting the query alone.
 */
export function isCollectionPublished(
  publishedAt: Date | null,
  now: Date = new Date(),
): boolean {
  return publishedAt !== null && publishedAt.getTime() <= now.getTime();
}

/**
 * Story 10.1: an empty collection cannot be published — users would open a
 * blank screen. The server refuses with `COLLECTION_EMPTY`, even though the
 * admin switch looks available.
 */
export function canPublishCollection(itemCount: number): boolean {
  return itemCount > 0;
}

/**
 * The position of a new idea: after the last stored one. Positions are only
 * compared, never used as array indexes, so gaps left by a deleted idea are
 * harmless. An empty collection starts at 0.
 */
export function nextItemPosition(items: readonly { readonly position: number }[]): number {
  let next = 0;
  for (const item of items) {
    if (item.position >= next) next = item.position + 1;
  }
  return next;
}

/**
 * Story 10.1: a reorder carries the full list of idea ids in the new order. It
 * is accepted only when it is exactly the stored set: a missing id would drop
 * an idea from the order and an unknown id could point at another collection's
 * row. The order of the result is the requested order.
 */
export function orderedItemIds(
  storedIds: readonly string[],
  requestedIds: readonly string[],
): string[] | null {
  if (storedIds.length !== requestedIds.length) return null;

  const stored = new Set(storedIds);
  if (stored.size !== storedIds.length) return null;

  const seen = new Set<string>();
  for (const id of requestedIds) {
    if (!stored.has(id) || seen.has(id)) return null;
    seen.add(id);
  }
  return [...requestedIds];
}

/** One idea as the app shows it: no `position`, no timestamps. */
export function toEditorialItem(item: EditorialItemStored): EditorialItem {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    linkUrl: item.linkUrl,
    imageUrl: item.imageUrl,
  };
}

/** The app's collection card. */
export function toCollectionSummary(
  collection: EditorialCollectionRow,
  itemCount: number,
): EditorialCollectionSummary {
  return {
    id: collection.id,
    title: collection.title,
    description: collection.description,
    coverImageUrl: collection.coverImageUrl,
    itemCount,
  };
}

/** The app's one collection screen: the card fields and the ideas in order. */
export function toCollectionDetail(
  collection: EditorialCollectionStored,
): EditorialCollectionDetail {
  return {
    ...toCollectionSummary(collection, collection.items.length),
    items: collection.items.map(toEditorialItem),
  };
}

/**
 * The published collection the app may show, or `null` for a draft. The store
 * already filters the read; this second gate keeps the rule in the domain, so a
 * draft cannot leak through a different query later.
 */
export function visibleCollectionDetail(
  collection: EditorialCollectionStored,
  now: Date = new Date(),
): EditorialCollectionDetail | null {
  if (!isCollectionPublished(collection.publishedAt, now)) return null;
  return toCollectionDetail(collection);
}

/** One row of the `/admin` table; `publishedAt` is an ISO instant or `null`. */
export function toAdminSummary(
  collection: EditorialCollectionRow,
  itemCount: number,
): EditorialCollectionAdminSummary {
  return {
    ...toCollectionSummary(collection, itemCount),
    publishedAt: collection.publishedAt === null ? null : collection.publishedAt.toISOString(),
    updatedAt: collection.updatedAt.toISOString(),
  };
}

/** One collection in `/admin`: the table row plus its ideas in order. */
export function toAdminDetail(
  collection: EditorialCollectionStored,
): EditorialCollectionAdminDetail {
  return {
    ...toAdminSummary(collection, collection.items.length),
    items: collection.items.map(toAdminItem),
  };
}

/** One idea in `/admin`: the app fields plus the stored position. */
export function toAdminItem(item: EditorialItemStored): EditorialItemAdmin {
  return {
    ...toEditorialItem(item),
    position: item.position,
  };
}
