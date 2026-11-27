import "server-only";

import {
  notFoundError,
  type ActionResult,
  type EditorialCollectionDetail,
  type EditorialCollectionList,
  type GiftCard,
} from "@gift-list/contracts";
import { createGift } from "@/actions/gifts";
import { auth } from "@/lib/auth";
import {
  getPublishedEditorialCollection,
  listPublishedEditorialCollections,
} from "@/lib/editorial-store";

const unauthenticated = {
  ok: false as const,
  code: "UNAUTHENTICATED" as const,
  message: "Authentication required",
};

/**
 * Story 10.1 / AD-22 (CLE-143): the app's «Подборки» list. Only a signed-in
 * person reads it, and only published collections come back — the store filters
 * drafts and a future publication in SQL, so a draft never enters the answer.
 * The named `collections` key keeps an empty list a closed object, like the
 * wishlist and the tag catalog.
 */
export async function listCollections(
  headers: Headers,
): Promise<ActionResult<EditorialCollectionList>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const collections = await listPublishedEditorialCollections();
  return { ok: true, data: { collections } };
}

/**
 * Story 10.1: one published collection with its ideas in the editor's order.
 * An unpublished, future or unknown id is the same `NOT_FOUND` (AD-12), so the
 * app cannot tell a draft from a missing collection.
 */
export async function getCollection(
  headers: Headers,
  collectionId: string,
): Promise<ActionResult<EditorialCollectionDetail>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const collection = await getPublishedEditorialCollection(collectionId);
  if (collection === null) return notFoundError();

  return { ok: true, data: collection };
}

/**
 * Story 10.1 / ARCH-A17 (CLE-143): «Добавить в мой вишлист» creates an ordinary
 * wish through the existing create use-case — the same caps, the same limits and
 * the same `OPEN` + `PUBLIC` defaults as `POST /api/v1/me/gifts`. Only the
 * fields the app shows are copied: the idea's image stays on the card, because a
 * wish has no picture field.
 *
 * A draft, a deleted collection and a foreign item id answer `NOT_FOUND`; the
 * published read is repeated here, so an idea unpublished after the screen was
 * opened cannot slip into a wish.
 */
export async function addCollectionItemToWishlist(
  headers: Headers,
  collectionId: string,
  itemId: string,
): Promise<ActionResult<GiftCard>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const collection = await getPublishedEditorialCollection(collectionId);
  const item = collection?.items.find(function matchesItem(candidate) {
    return candidate.id === itemId;
  });
  if (item === undefined) return notFoundError();

  return createGift(headers, {
    title: item.title,
    description: item.description,
    linkUrl: item.linkUrl,
  });
}
