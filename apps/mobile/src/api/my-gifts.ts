import { listDataSchema, type GiftCard } from "@gift-list/contracts";
import { apiRequest, type ClientResult } from "@/api/client";

export type MyGiftsResult =
  | { ok: true; access: "gifts"; gifts: GiftCard[] }
  | { ok: true; access: "not_found" }
  | Exclude<ClientResult<unknown>, { ok: true }>;

/**
 * AD-7 owner branch behind `/api/v1/me/gifts` (AD-17: the app talks only to `api/v1`).
 * The payload is re-checked with the shared contract (AD-12): `listDataSchema` is
 * `{ access, gifts: giftCardSchema[] }`, a closed set on every card. A body that does
 * not match is as unusable as a broken connection, so the screen recovers the same way.
 * A closed gate (`access: "not_found"`) stays its own outcome: it is not an empty list
 * (EXPERIENCE → State Patterns → «Список не найден»).
 */
export async function fetchMyGifts(): Promise<MyGiftsResult> {
  const result = await apiRequest<unknown>("/api/v1/me/gifts");
  if (!result.ok) return result;

  const parsed = listDataSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, network: true };

  if (parsed.data.access === "not_found") return { ok: true, access: "not_found" };

  return { ok: true, access: "gifts", gifts: parsed.data.gifts };
}
