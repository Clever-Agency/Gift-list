import {
  giftCardSchema,
  giftVisibilityPreviewSchema,
  listDataSchema,
  type GiftCard,
  type GiftInputDraft,
  type GiftUpdate,
  type GiftVisibilityPreview,
  type GiftVisibilityPreviewQuery,
} from "@gift-list/contracts";
import { apiRequest, type ClientResult } from "@/api/client";

export type MyGiftsResult =
  | { ok: true; access: "gifts"; gifts: GiftCard[]; publicToken: string | null }
  | { ok: true; access: "not_found" }
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

/**
 * The create, the single read and the edit all answer with the same AD-12 card,
 * so they share one outcome type instead of three identical ones.
 */
export type GiftResult =
  | { ok: true; gift: GiftCard }
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

export type CreateGiftResult = GiftResult;

export type DeleteGiftResult =
  | { ok: true }
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

/**
 * The preflight of a visibility change (CLE-82/S23.2) answers `{ wouldCancelReservation }`
 * in the AD-12 envelope, so a body that does not match is its own outcome.
 */
export type GiftVisibilityPreviewResult =
  | { ok: true; preview: GiftVisibilityPreview }
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

/**
 * AD-7 owner branch behind `/api/v1/me/gifts` (AD-17: the app talks only to `api/v1`).
 * The payload is re-checked with the shared contract (AD-12): `listDataSchema` is
 * `{ access, gifts: giftCardSchema[], publicToken? }`, a closed set on every card.
 * A body that does not match is its own outcome (`invalid`): the screen still
 * recovers with the retry view, but it does not claim a broken connection. A closed
 * gate (`access: "not_found"`) stays its own outcome: it is not an empty list
 * (EXPERIENCE → State Patterns → «Список не найден»).
 *
 * Story 2.4: the owner answer carries the immutable `publicToken` (AD-6), from
 * which the screen builds `https://{домен}/l/{publicToken}`. The server repairs
 * a missing `List` row and repeats the owner read, so the token is present for a
 * zero-gift wishlist too. `null` is only a defensive fallback for an unexpected
 * older/inconsistent server payload; the token does not depend on the nick (A-26).
 */
export async function fetchMyGifts(): Promise<MyGiftsResult> {
  const result = await apiRequest<unknown>("/api/v1/me/gifts");
  if (!result.ok) return result;

  const parsed = listDataSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  if (parsed.data.access === "not_found") return { ok: true, access: "not_found" };

  return {
    ok: true,
    access: "gifts",
    gifts: parsed.data.gifts,
    publicToken: parsed.data.publicToken ?? null,
  };
}

/**
 * Story 2.2 (FR-10): `POST /api/v1/me/gifts` creates the owner's wish and answers
 * with the AD-12 card. The transport, timeout and envelope live in `apiRequest`;
 * the card is re-checked with the shared contract (AD-12) like the list read, so
 * an unexpected payload is `invalid`, not a broken connection.
 *
 * The body is the schema's input side (`GiftInputDraft`): `visibility` and
 * `quantity` are optional there, so a caller may rely on the contract's
 * `PUBLIC`/`SINGLE` defaults instead of hard-coding them.
 */
export async function createGift(input: GiftInputDraft): Promise<CreateGiftResult> {
  const result = await apiRequest<unknown>("/api/v1/me/gifts", {
    method: "POST",
    body: input,
  });
  if (!result.ok) return result;

  const parsed = giftCardSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true, gift: parsed.data };
}

/**
 * Story 2.2 (FR-10): `GET /api/v1/me/gifts/{id}` reads one own wish, so the edit
 * screen loads a single card instead of picking it out of the list. The id is a
 * path segment, hence encoded; the card is re-checked with the shared contract
 * (AD-12) like the list read, so an unexpected payload is `invalid` rather than
 * a broken connection.
 */
export async function fetchGift(id: string): Promise<GiftResult> {
  const result = await apiRequest<unknown>(
    `/api/v1/me/gifts/${encodeURIComponent(id)}`,
  );
  if (!result.ok) return result;

  const parsed = giftCardSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true, gift: parsed.data };
}

/**
 * Story 2.3 (FR-10): `DELETE /api/v1/me/gifts/{id}` removes an open wish of the
 * owner's list and answers with the deleted id. The id is a path segment, hence
 * encoded; a body that does not echo the same id is `invalid` rather than a
 * broken connection. The server answers NOT_FOUND for a foreign, archived or
 * missing wish and CONFLICT for a reserved or closed one (AD-6…AD-8).
 */
export async function deleteGift(id: string): Promise<DeleteGiftResult> {
  const result = await apiRequest<unknown>(
    `/api/v1/me/gifts/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
  if (!result.ok) return result;

  const data = result.data;
  if (typeof data !== "object" || data === null) {
    return { ok: false, invalid: true };
  }
  const record = data as Record<string, unknown>;
  if (typeof record.id !== "string" || record.id !== id) {
    return { ok: false, invalid: true };
  }

  return { ok: true };
}

/**
 * Story 2.2 (FR-10, AD-1): `PATCH /api/v1/me/gifts/{id}` edits an own wish. The
 * body is a partial — an absent field keeps its stored value — and the answer is
 * the AD-12 card, re-checked here like the create.
 */
export async function updateGift(
  id: string,
  input: GiftUpdate,
): Promise<GiftResult> {
  const result = await apiRequest<unknown>(
    `/api/v1/me/gifts/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: input,
    },
  );
  if (!result.ok) return result;

  const parsed = giftCardSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true, gift: parsed.data };
}

/**
 * CLE-82 (FR-10 ред. 2026-11-11, AD-7): preflight of a visibility change on the
 * owner's wish — `GET /api/v1/me/gifts/{id}/visibility?visibility=FRIENDS`.
 * It writes nothing and answers whether the new value would take the holder's
 * access away, so the screens show the confirm «Бронирующий потеряет доступ,
 * бронь снимется» only on `true`. The write repeats the same rule inside its own
 * transaction, so this answer may be stale without becoming unsafe. The id is a
 * path segment (encoded); the value is one enum word, so it needs no list query.
 * The answer is re-checked with the shared contract: another body is `invalid`.
 */
export async function previewGiftVisibility(
  id: string,
  visibility: GiftVisibilityPreviewQuery["visibility"],
): Promise<GiftVisibilityPreviewResult> {
  const result = await apiRequest<unknown>(
    `/api/v1/me/gifts/${encodeURIComponent(id)}/visibility?visibility=${encodeURIComponent(visibility)}`,
  );
  if (!result.ok) return result;

  const parsed = giftVisibilityPreviewSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true, preview: parsed.data };
}
