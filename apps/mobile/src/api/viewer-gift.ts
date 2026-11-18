import {
  giftCardSchema,
  giftReserveBodySchema,
  isNotFound,
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

/** Story 5.1: read one foreign wish for the detail and reserve UI. */
export async function fetchViewerGift(id: string): Promise<ViewerGiftResult> {
  const result = await apiRequest<unknown>(`/api/v1/gifts/${encodeURIComponent(id)}`);
  if (!result.ok) return result;

  const parsed = giftCardSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true, gift: parsed.data };
}

/** Story 5.1: CAS reserve through `POST /api/v1/gifts/:id/reserve`. */
export async function reserveGift(
  id: string,
  body: GiftReserveBody,
): Promise<ReserveGiftResult> {
  const payload = giftReserveBodySchema.safeParse(body);
  if (!payload.success) return { ok: false, invalid: true };

  const result = await apiRequest<unknown>(
    `/api/v1/gifts/${encodeURIComponent(id)}/reserve`,
    { method: "POST", body: payload.data },
  );
  if (!result.ok) return result;

  const parsed = giftCardSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true, gift: parsed.data };
}