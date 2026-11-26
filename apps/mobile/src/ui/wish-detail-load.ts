import type { GiftCard } from "@gift-list/contracts";
import { fetchGift } from "@/api/my-gifts";

export type DetailLoadResult =
  | { ok: true; gift: GiftCard }
  | { ok: false; reason: "not_found" | "network" | "unavailable" };

/**
 * Owner read of one wish for the page `/gifts/{id}` (AD-15 (14), D-63): only the
 * owner route, which carries no reservation. A missing wish is «не найдено», never
 * a list snapshot; a refused or broken read is a generic failure.
 *
 * The guest's read of one wish lives on the page itself (`fetchViewerGift`): the
 * detail dialog that this snapshot fallback served is gone (CLE-129, T4.4).
 */
export async function loadOwnerDetail(id: string): Promise<DetailLoadResult> {
  const result = await fetchGift(id);
  if (result.ok) return { ok: true, gift: result.gift };
  if ("network" in result && result.network) return { ok: false, reason: "network" };
  if ("code" in result && result.code === "NOT_FOUND") return { ok: false, reason: "not_found" };
  return { ok: false, reason: "unavailable" };
}
