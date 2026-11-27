import {
  editorialCollectionDetailSchema,
  editorialCollectionListSchema,
  giftCardSchema,
  isNotFound,
  type EditorialCollectionDetail,
  type EditorialCollectionSummary,
  type GiftCard,
} from "@gift-list/contracts";
import { apiRequest, type ClientResult } from "@/api/client";

export type CollectionsResult =
  | { ok: true; collections: EditorialCollectionSummary[] }
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

export type CollectionResult =
  | { ok: true; collection: EditorialCollectionDetail }
  | { ok: true; access: "not_found" }
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

export type AddCollectionItemResult =
  | { ok: true; gift: GiftCard }
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

/**
 * Story 10.1 (CLE-143, AD-22): `GET /api/v1/collections` — published editorial
 * collections of the signed-in person. The server already hides drafts, so the
 * app never filters by publication itself. The answer is re-checked with the
 * shared contract (AD-12): an unexpected body is `invalid`, not a broken
 * connection.
 */
export async function fetchCollections(): Promise<CollectionsResult> {
  const result = await apiRequest<unknown>("/api/v1/collections");
  if (!result.ok) return result;

  const parsed = editorialCollectionListSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true, collections: parsed.data.collections };
}

/**
 * Story 10.1: one published collection with its ideas in the editor's order.
 * A draft, a future publication and an unknown id are the same HTTP `NOT_FOUND`
 * (AD-12); the screen shows the one 404 page and cannot tell them apart.
 */
export async function fetchCollection(id: string): Promise<CollectionResult> {
  const result = await apiRequest<unknown>(
    `/api/v1/collections/${encodeURIComponent(id)}`,
  );
  if (isNotFound(result)) return { ok: true, access: "not_found" };
  if (!result.ok) return result;

  const parsed = editorialCollectionDetailSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true, collection: parsed.data };
}

/**
 * Story 10.1 / ARCH-A17: «Добавить в мой вишлист». The server creates an
 * ordinary `OPEN` wish with the default `PUBLIC` visibility through the same
 * use-case as the composer, so the app sends no body — there is nothing for the
 * client to choose. The answer is the created wish card, re-checked here.
 */
export async function addCollectionItem(
  collectionId: string,
  itemId: string,
): Promise<AddCollectionItemResult> {
  const result = await apiRequest<unknown>(
    `/api/v1/collections/${encodeURIComponent(collectionId)}/items/${encodeURIComponent(itemId)}/add`,
    { method: "POST" },
  );
  if (!result.ok) return result;

  const parsed = giftCardSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true, gift: parsed.data };
}
