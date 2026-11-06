import { safeNextPath } from "@gift-list/contracts";

/**
 * Story 3.3 / AD-26: a public list token is exactly one safe path segment.
 *
 * The app receives the token from the `/wishlist/:token` route, so it is used
 * twice: as the `api/v1` request segment and as the `next` target after login.
 * Both must be built from this one validated value. `safeNextPath` already
 * normalises `/l/:token` to `/wishlist/:token`; here it proves the value stays
 * in that exact form, so `?`, `#`, encoded separators, dot segments and extra
 * slash-separated parts never reach the API or the login redirect.
 *
 * The length ceiling mirrors the server's link gate (Story 3.3.1). Existence is
 * not checked here: the server answers every unknown token with the same
 * `not_found` as a block.
 */
export const PUBLIC_WISHLIST_TOKEN_MAX_LENGTH = 128;

const WISHLIST_PREFIX = "/wishlist/";

/**
 * A query/fragment delimiter or any percent-encoding could change what the
 * browser or the API requests, so those values are not a token at all (the same
 * rule as the Next page in Story 3.3.2).
 */
const UNSAFE_SEGMENT_CHARACTERS = /[\\/?#%\u0000-\u001f\u007f]/;

export type PublicWishlistRoute = {
  readonly token: string;
  readonly next: string;
};

export function publicWishlistRoute(value: unknown): PublicWishlistRoute | null {
  if (typeof value !== "string") return null;
  if (value.length === 0 || value.length > PUBLIC_WISHLIST_TOKEN_MAX_LENGTH) return null;
  if (UNSAFE_SEGMENT_CHARACTERS.test(value)) return null;
  // A dot segment can traverse or normalise away part of the path (Story 3.3.1 gate).
  if (value === "." || value === ".." || value.includes("..")) return null;

  const next = `${WISHLIST_PREFIX}${value}`;
  if (safeNextPath(next) !== next) return null;

  return { token: value, next };
}
