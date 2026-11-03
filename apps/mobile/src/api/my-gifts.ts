import {
  giftCardSchema,
  listDataSchema,
  type GiftCard,
  type GiftInput,
} from "@gift-list/contracts";
import { apiRequest, type ClientResult } from "@/api/client";

export type MyGiftsResult =
  | { ok: true; access: "gifts"; gifts: GiftCard[] }
  | { ok: true; access: "not_found" }
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

export type CreateGiftResult =
  | { ok: true; gift: GiftCard }
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

/**
 * AD-7 owner branch behind `/api/v1/me/gifts` (AD-17: the app talks only to `api/v1`).
 * The payload is re-checked with the shared contract (AD-12): `listDataSchema` is
 * `{ access, gifts: giftCardSchema[] }`, a closed set on every card. A body that does
 * not match is its own outcome (`invalid`): the screen still recovers with the retry
 * view, but it does not claim a broken connection. A closed gate (`access: "not_found"`)
 * stays its own outcome: it is not an empty list
 * (EXPERIENCE → State Patterns → «Список не найден»).
 */
export async function fetchMyGifts(): Promise<MyGiftsResult> {
  const result = await apiRequest<unknown>("/api/v1/me/gifts");
  if (!result.ok) return result;

  const parsed = listDataSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  if (parsed.data.access === "not_found") return { ok: true, access: "not_found" };

  return { ok: true, access: "gifts", gifts: parsed.data.gifts };
}

/**
 * Story 2.2 (FR-10): `POST /api/v1/me/gifts` creates the owner's wish and answers
 * with the AD-12 card. The transport, timeout and envelope live in `apiRequest`;
 * the card is re-checked with the shared contract (AD-12) like the list read, so
 * an unexpected payload is `invalid`, not a broken connection.
 */
export async function createGift(input: GiftInput): Promise<CreateGiftResult> {
  const result = await apiRequest<unknown>("/api/v1/me/gifts", {
    method: "POST",
    body: input,
  });
  if (!result.ok) return result;

  const parsed = giftCardSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true, gift: parsed.data };
}
