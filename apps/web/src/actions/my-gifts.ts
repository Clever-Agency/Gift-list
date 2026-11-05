import "server-only";

import type { ActionResult, ListData } from "@gift-list/contracts";
import { negotiateLocale, preferredFromAcceptLanguage } from "@gift-list/contracts";
import { readWishlist } from "@/actions/wishlist-read";
import { auth } from "@/lib/auth";

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
 */
export async function getMyGifts(headers: Headers): Promise<ActionResult<ListData>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const ownerId = session.user.id;
  // AD-27: fixed tag labels follow the request language, like the catalog read.
  const locale = negotiateLocale(preferredFromAcceptLanguage(headers.get("accept-language")));
  const data = await readWishlist({ viewer: { id: ownerId }, target: { ownerId }, locale });
  // AD-6 creates the list at registration; a missing row is an anomaly, and an
  // empty wishlist is safer on the owner's own screen than a gate error.
  if (data.access === "not_found") return { ok: true, data: { access: "gifts", gifts: [] } };

  return { ok: true, data };
}
