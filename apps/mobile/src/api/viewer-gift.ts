import {
  giftCardSchema,
  giftReserveBodySchema,
  type GiftCard,
  type GiftReserveBody,
} from "@gift-list/contracts";
import { apiRequest, type ClientResult } from "@/api/client";

export type ViewerGiftResult =
  | { ok: true; gift: GiftCard }
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

export type ReserveGiftResult =
  | { ok: true; gift: GiftCard }
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

/**
 * Story 5.2: the holder's release answers `{ id }`, not a card — after the release
 * the holder may have lost access to the wish by AD-7, so the screen applies the
 * known `RESERVED → OPEN` transition itself.
 */
export type ReleaseGiftResult =
  | { ok: true }
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

function withListToken(path: string, listToken?: string): string {
  if (!listToken) return path;
  return `${path}?listToken=${encodeURIComponent(listToken)}`;
}

/** Story 5.1: read one foreign wish for the detail and reserve UI. */
export async function fetchViewerGift(id: string, listToken?: string): Promise<ViewerGiftResult> {
  const result = await apiRequest<unknown>(
    withListToken(`/api/v1/gifts/${encodeURIComponent(id)}`, listToken),
  );
  if (!result.ok) return result;

  const parsed = giftCardSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true, gift: parsed.data };
}

/** Story 5.1: CAS reserve through `POST /api/v1/gifts/:id/reserve`. */
export async function reserveGift(
  id: string,
  body: GiftReserveBody,
  listToken?: string,
): Promise<ReserveGiftResult> {
  const payload = giftReserveBodySchema.safeParse(body);
  if (!payload.success) return { ok: false, invalid: true };

  const result = await apiRequest<unknown>(
    withListToken(`/api/v1/gifts/${encodeURIComponent(id)}/reserve`, listToken),
    { method: "POST", body: payload.data },
  );
  if (!result.ok) return result;

  const parsed = giftCardSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true, gift: parsed.data };
}

/**
 * Story 5.2: `DELETE /api/v1/gifts/{id}/reserve` removes the holder's own
 * reservation (`{ id }` in the AD-12 envelope). The route authorizes by
 * `reservedById` and checks no visibility (A-14), so the id is the only input.
 * A body that does not echo the same id is `invalid`, as the owner's delete.
 */
export async function releaseMyReservation(id: string): Promise<ReleaseGiftResult> {
  const result = await apiRequest<unknown>(
    `/api/v1/gifts/${encodeURIComponent(id)}/reserve`,
    { method: "DELETE" },
  );
  if (!result.ok) return result;

  const data = result.data;
  if (typeof data !== "object" || data === null) return { ok: false, invalid: true };
  const record = data as Record<string, unknown>;
  if (typeof record.id !== "string" || record.id !== id) return { ok: false, invalid: true };

  return { ok: true };
}