import type { GiftCard } from "@gift-list/contracts";
import { fetchGift } from "@/api/my-gifts";
import { fetchViewerGift } from "@/api/viewer-gift";

export type DetailLoadResult =
  | { ok: true; gift: GiftCard }
  | { ok: false; reason: "not_found" | "network" | "unavailable" };

function refusal(
  result: { ok: false },
): DetailLoadResult | "list" {
  if ("network" in result && result.network) return { ok: false, reason: "network" };
  if ("code" in result && result.code === "NOT_FOUND") return { ok: false, reason: "not_found" };
  // The viewer route answers 401/403 without a body. The list card was already
  // authorized, so the caller may keep it. Anything else is a generic failure.
  if ("code" in result && (result.code === "UNAUTHENTICATED" || result.code === "FORBIDDEN")) {
    return "list";
  }
  return { ok: false, reason: "unavailable" };
}

/** Owner read of one wish. A missing wish is «не найдено», never the list snapshot. */
export async function loadOwnerDetail(id: string): Promise<DetailLoadResult> {
  const result = await fetchGift(id);
  if (result.ok) return { ok: true, gift: result.gift };
  const reason = refusal(result);
  if (reason === "list") return { ok: false, reason: "unavailable" };
  return reason;
}

/**
 * Guest read. `NOT_FOUND` hides the snapshot. A 401/403 keeps the list card:
 * that card already passed `VisibilityPolicy`, and the error text must not
 * explain why the single-gift route refused.
 */
export async function loadViewerDetail(
  id: string,
  listToken: string | undefined,
  snapshot: GiftCard,
): Promise<DetailLoadResult> {
  const result = await fetchViewerGift(id, listToken);
  if (result.ok) return { ok: true, gift: result.gift };
  const reason = refusal(result);
  if (reason === "list") return { ok: true, gift: snapshot };
  return reason;
}
