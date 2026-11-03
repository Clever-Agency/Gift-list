import { listDataSchema, type GiftCard } from "@gift-list/contracts";
import { apiRequest, type ClientResult } from "@/api/client";

export type MyGiftsResult =
  | { ok: true; gifts: GiftCard[] }
  | Exclude<ClientResult<unknown>, { ok: true }>;

/**
 * AD-7 owner branch behind `/api/v1/me/gifts` (AD-17: the app talks only to `api/v1`).
 * The payload is re-checked with the shared contract (AD-12): `listDataSchema` is
 * `{ access, gifts: giftCardSchema[] }`, a closed set on every card. A body that does
 * not match is as unusable as a broken connection, so the screen recovers the same way.
 */
export async function fetchMyGifts(): Promise<MyGiftsResult> {
  const result = await apiRequest<unknown>("/api/v1/me/gifts");
  if (!result.ok) return result;

  const parsed = listDataSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, network: true };

  return {
    ok: true,
    gifts: parsed.data.access === "gifts" ? parsed.data.gifts : [],
  };
}
