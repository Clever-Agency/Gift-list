import { listDataSchema, type GiftCard } from "@gift-list/contracts";
import { apiRequest, type ClientResult } from "@/api/client";
import { publicWishlistRoute } from "@/wishlist/public-token";

/** The two owner fields a link read may name (Story 3.3.1). */
export type PublicWishlistOwner = {
  readonly displayName: string;
  readonly nick: string;
};

/**
 * The link read has three outcomes: a named list, the closed `not_found` gate,
 * or a failed request. A found list without the owner block is treated as the
 * same closed gate, like the Next page, so the app never renders an unnamed
 * list that the server did not describe.
 */
export type PublicWishlistResult =
  | { ok: true; access: "gifts"; gifts: GiftCard[]; owner: PublicWishlistOwner }
  | { ok: true; access: "not_found" }
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

/**
 * Story 3.3 / AD-7: `GET /api/v1/l/:token` through the shared `apiRequest`
 * transport (cookie on the web, bearer on the phone). The server applies
 * `VisibilityPolicy`; the client only checks the AD-12 envelope and never
 * filters wishes by visibility on its own. A malformed segment is the same
 * `not_found` before a request, matching the server route.
 */
export async function fetchPublicWishlist(token: string): Promise<PublicWishlistResult> {
  const route = publicWishlistRoute(token);
  if (route === null) return { ok: true, access: "not_found" };

  const result = await apiRequest<unknown>(
    `/api/v1/l/${encodeURIComponent(route.token)}`,
  );
  if (!result.ok) return result;

  const parsed = listDataSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  if (parsed.data.access === "not_found") return { ok: true, access: "not_found" };
  if (parsed.data.owner === undefined) return { ok: true, access: "not_found" };

  return {
    ok: true,
    access: "gifts",
    gifts: parsed.data.gifts,
    owner: parsed.data.owner,
  };
}
