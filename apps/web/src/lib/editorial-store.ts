import "server-only";

import type {
  EditorialCollectionAdminDetail,
  EditorialCollectionAdminSummary,
  EditorialCollectionDetail,
  EditorialCollectionInput,
  EditorialCollectionSummary,
  EditorialItemInput,
} from "@gift-list/contracts";
import { prisma } from "@/db/client";
import {
  canPublishCollection,
  nextItemPosition,
  orderedItemIds,
  toAdminDetail,
  toAdminSummary,
  toCollectionSummary,
  visibleCollectionDetail,
} from "@/domain/editorial";

/**
 * Columns of one idea (AD-22, Story 10.1). The app never receives `position`
 * (its read is already ordered), the admin panel does; timestamps stay in the
 * database.
 */
const itemSelect = {
  id: true,
  title: true,
  description: true,
  linkUrl: true,
  imageUrl: true,
  position: true,
} as const;

/** Columns the `/admin` table needs: the card fields, the count and the state. */
const adminListSelect = {
  id: true,
  title: true,
  description: true,
  coverImageUrl: true,
  publishedAt: true,
  _count: { select: { items: true } },
} as const;

/**
 * Story 10.1: everything `/admin` lists, newest first — drafts and published
 * collections alike. `_count.items` is the number the table shows, so the list
 * does not load every idea. `id` keeps the order stable for equal timestamps.
 */
export async function listEditorialCollectionsForAdmin(): Promise<
  EditorialCollectionAdminSummary[]
> {
  const rows = await prisma.editorialCollection.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: adminListSelect,
  });
  return rows.map(function toSummary(row) {
    return toAdminSummary(row, row._count.items);
  });
}

/** One collection with its ideas in the stored order, or `null` if it is gone. */
export async function getEditorialCollectionForAdmin(
  id: string,
): Promise<EditorialCollectionAdminDetail | null> {
  const row = await prisma.editorialCollection.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      coverImageUrl: true,
      publishedAt: true,
      items: {
        orderBy: [{ position: "asc" }, { id: "asc" }],
        select: itemSelect,
      },
    },
  });
  if (row === null) return null;
  return toAdminDetail(row);
}

/** Story 10.1: a new collection is a draft — `publishedAt` stays `null`. */
export async function createEditorialCollection(
  input: EditorialCollectionInput,
): Promise<EditorialCollectionAdminDetail> {
  const row = await prisma.editorialCollection.create({
    data: {
      title: input.title,
      description: input.description ?? null,
      coverImageUrl: input.coverImageUrl ?? null,
    },
    select: {
      id: true,
      title: true,
      description: true,
      coverImageUrl: true,
      publishedAt: true,
      items: {
        orderBy: [{ position: "asc" }, { id: "asc" }],
        select: itemSelect,
      },
    },
  });
  return toAdminDetail(row);
}

/**
 * Story 10.1: the edit form sends the whole card, so an absent description or
 * cover clears the stored one. A missing id answers `null` (the action turns it
 * into `NOT_FOUND`).
 */
export async function updateEditorialCollection(
  id: string,
  input: EditorialCollectionInput,
): Promise<EditorialCollectionAdminDetail | null> {
  const { count } = await prisma.editorialCollection.updateMany({
    where: { id },
    data: {
      title: input.title,
      description: input.description ?? null,
      coverImageUrl: input.coverImageUrl ?? null,
    },
  });
  if (count === 0) return null;
  return getEditorialCollectionForAdmin(id);
}

/**
 * Story 10.1: deleting a collection deletes its ideas (`onDelete: Cascade`),
 * and its publication with it. A foreign id removes nothing.
 */
export async function deleteEditorialCollection(id: string): Promise<boolean> {
  const { count } = await prisma.editorialCollection.deleteMany({ where: { id } });
  return count > 0;
}

/**
 * Story 10.1: a new idea joins the end of the collection.
 *
 * The advisory lock on the collection id serializes two simultaneous appends,
 * so both cannot read the same last position and get the same one (the same
 * plain PostgreSQL tool `personal-dates-store` uses). A missing collection
 * inserts nothing and answers `null`.
 */
export async function createEditorialItem(
  collectionId: string,
  input: EditorialItemInput,
): Promise<EditorialCollectionAdminDetail | null> {
  const created = await prisma.$transaction(async function appendItem(tx) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`editorial-items:${collectionId}`}, 0))`;

    const collection = await tx.editorialCollection.findUnique({
      where: { id: collectionId },
      select: { id: true },
    });
    if (collection === null) return false;

    const last = await tx.editorialItem.findFirst({
      where: { collectionId },
      orderBy: [{ position: "desc" }, { id: "desc" }],
      select: { position: true },
    });

    await tx.editorialItem.create({
      data: {
        collectionId,
        title: input.title,
        description: input.description ?? null,
        linkUrl: input.linkUrl ?? null,
        imageUrl: input.imageUrl ?? null,
        position: nextItemPosition(last === null ? [] : [last]),
      },
    });
    return true;
  });

  if (!created) return null;
  return getEditorialCollectionForAdmin(collectionId);
}

/**
 * Story 10.1: edit one idea. The `collectionId` in the filter makes an idea of
 * another collection indistinguishable from a missing one.
 */
export async function updateEditorialItem(
  collectionId: string,
  itemId: string,
  input: EditorialItemInput,
): Promise<EditorialCollectionAdminDetail | null> {
  const { count } = await prisma.editorialItem.updateMany({
    where: { id: itemId, collectionId },
    data: {
      title: input.title,
      description: input.description ?? null,
      linkUrl: input.linkUrl ?? null,
      imageUrl: input.imageUrl ?? null,
    },
  });
  if (count === 0) return null;
  return getEditorialCollectionForAdmin(collectionId);
}

/** Story 10.1: remove one idea; a foreign id removes nothing. */
export async function deleteEditorialItem(
  collectionId: string,
  itemId: string,
): Promise<boolean> {
  const { count } = await prisma.editorialItem.deleteMany({
    where: { id: itemId, collectionId },
  });
  return count > 0;
}

export type ReorderEditorialItemsResult =
  | { readonly ok: true; readonly data: EditorialCollectionAdminDetail }
  | { readonly ok: false; readonly reason: "not-found" }
  | { readonly ok: false; readonly reason: "order" };

/**
 * Story 10.1: the full new order of one collection's ideas, written as
 * `0..n-1`. The stored set has to match the request exactly (see
 * `orderedItemIds`); the row updates run in one transaction under the same
 * advisory lock as an append, so a concurrent add cannot interleave.
 */
export async function reorderEditorialItems(
  collectionId: string,
  itemIds: readonly string[],
): Promise<ReorderEditorialItemsResult> {
  const outcome = await prisma.$transaction(async function reorder(tx) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`editorial-items:${collectionId}`}, 0))`;

    const collection = await tx.editorialCollection.findUnique({
      where: { id: collectionId },
      select: { id: true },
    });
    if (collection === null) return { ok: false, reason: "not-found" } as const;

    const rows = await tx.editorialItem.findMany({
      where: { collectionId },
      orderBy: [{ position: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    const order = orderedItemIds(
      rows.map(function toId(row) {
        return row.id;
      }),
      itemIds,
    );
    if (order === null) return { ok: false, reason: "order" } as const;

    for (const [position, id] of order.entries()) {
      await tx.editorialItem.updateMany({
        where: { id, collectionId },
        data: { position },
      });
    }
    return { ok: true } as const;
  });

  if (!outcome.ok) return outcome;
  const detail = await getEditorialCollectionForAdmin(collectionId);
  if (detail === null) return { ok: false, reason: "not-found" };
  return { ok: true, data: detail };
}

export type PublishEditorialCollectionResult =
  | { readonly ok: true; readonly data: EditorialCollectionAdminSummary }
  | { readonly ok: false; readonly reason: "not-found" }
  | { readonly ok: false; readonly reason: "empty" };

/**
 * Story 10.1: publishing stamps `publishedAt = now()`; the app starts showing
 * the collection. An empty one is refused with `reason: "empty"` — the action
 * answers `COLLECTION_EMPTY` and the admin sees «Пустую подборку нельзя
 * опубликовать». The count and the stamp share the transaction and the
 * append lock, so an idea cannot disappear between the check and the write.
 */
export async function publishEditorialCollection(
  id: string,
): Promise<PublishEditorialCollectionResult> {
  return prisma.$transaction(async function publish(tx) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`editorial-items:${id}`}, 0))`;

    const collection = await tx.editorialCollection.findUnique({
      where: { id },
      select: { id: true },
    });
    if (collection === null) return { ok: false, reason: "not-found" } as const;

    const itemCount = await tx.editorialItem.count({ where: { collectionId: id } });
    if (!canPublishCollection(itemCount)) return { ok: false, reason: "empty" } as const;

    const row = await tx.editorialCollection.update({
      where: { id },
      data: { publishedAt: new Date() },
      select: adminListSelect,
    });
    return { ok: true, data: toAdminSummary(row, row._count.items) } as const;
  });
}

/**
 * Story 10.1: unpublishing clears `publishedAt`; the app stops showing the
 * collection, the ideas stay as they are. A missing id answers `null`.
 */
export async function unpublishEditorialCollection(
  id: string,
): Promise<EditorialCollectionAdminSummary | null> {
  const { count } = await prisma.editorialCollection.updateMany({
    where: { id },
    data: { publishedAt: null },
  });
  if (count === 0) return null;

  const row = await prisma.editorialCollection.findUnique({
    where: { id },
    select: adminListSelect,
  });
  if (row === null) return null;
  return toAdminSummary(row, row._count.items);
}

/**
 * Story 10.1: the app's «Подборки» list — published collections only, newest
 * publication first. Drafts and a future stamp are filtered out in SQL, so they
 * never enter an answer (AD-22, S1-common).
 */
export async function listPublishedEditorialCollections(
  now: Date = new Date(),
): Promise<EditorialCollectionSummary[]> {
  const rows = await prisma.editorialCollection.findMany({
    where: { publishedAt: { not: null, lte: now } },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      coverImageUrl: true,
      publishedAt: true,
      _count: { select: { items: true } },
    },
  });
  return rows.map(function toSummary(row) {
    return toCollectionSummary(row, row._count.items);
  });
}

/**
 * Story 10.1: one published collection with its ideas in order. A draft, an
 * unknown id and a future publication are the same `null`, so the app's route
 * answers `not_found` without telling the difference (AD-12).
 */
export async function getPublishedEditorialCollection(
  id: string,
  now: Date = new Date(),
): Promise<EditorialCollectionDetail | null> {
  const row = await prisma.editorialCollection.findFirst({
    where: { id, publishedAt: { not: null, lte: now } },
    select: {
      id: true,
      title: true,
      description: true,
      coverImageUrl: true,
      publishedAt: true,
      items: {
        orderBy: [{ position: "asc" }, { id: "asc" }],
        select: itemSelect,
      },
    },
  });
  if (row === null) return null;
  return visibleCollectionDetail(row, now);
}
