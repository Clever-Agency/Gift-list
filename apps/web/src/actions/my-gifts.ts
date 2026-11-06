import "server-only";

import type { ActionResult, ListData } from "@gift-list/contracts";
import { negotiateLocale, preferredFromAcceptLanguage } from "@gift-list/contracts";
import { readWishlist } from "@/actions/wishlist-read";
import { auth } from "@/lib/auth";
import { ensureOwnerList } from "@/lib/owner-list";

const unauthenticated = {
  ok: false as const,
  code: "UNAUTHENTICATED" as const,
  message: "Authentication required",
};

/**
 * AD-7 owner branch: the caller's own wishlist, read through the shared
 * `readWishlist` gate so no raw `findMany` by `listId` bypasses the policy.
 * Every visibility, including `SECRET`, comes back; archived gifts stay out of
 * the active list (AD-8) until the archive section of Story 2.6. Shared by the
 * app screen and any `api/v1` adapter.
 *
 * AD-6: the list is created at registration, so a missing row is an anomaly.
 * The read repairs it once and repeats the read, so the owner still receives the
 * immutable `publicToken`; if the row cannot be produced, the owner gets an
 * explicit `NOT_FOUND` instead of a tokenless empty list.
 */
export async function getMyGifts(headers: Headers): Promise<ActionResult<ListData>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const ownerId = session.user.id;
  // AD-27: fixed tag labels follow the request language, like the catalog read.
  const locale = negotiateLocale(preferredFromAcceptLanguage(headers.get("accept-language")));
  let data = await readWishlist({ viewer: { id: ownerId }, target: { ownerId }, locale });

  // AD-6 creates the list at registration, so a missing row is an anomaly, not
  // an empty wishlist. Repair it once and re-read: the owner must receive the
  // immutable share token for historical or inconsistent rows. A token that
  // already exists is never regenerated (`ensureOwnerList` only inserts).
  if (data.access === "not_found") {
    await ensureOwnerList(ownerId);
    console.warn("Missing List row repaired for owner", ownerId);
    data = await readWishlist({ viewer: { id: ownerId }, target: { ownerId }, locale });
    if (data.access === "not_found") {
      return { ok: false, code: "NOT_FOUND", message: "Wishlist not found" };
    }
  }

  return { ok: true, data };
}
