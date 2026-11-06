import "server-only";

import {
  listDataSchema,
  negotiateLocale,
  preferredFromAcceptLanguage,
  type ActionResult,
  type ListData,
} from "@gift-list/contracts";
import { readWishlist } from "@/actions/wishlist-read";
import { auth } from "@/lib/auth";

/**
 * A `publicToken` is a CUID2 (24 characters). The cap is the same order as
 * `safeNextPath`: long enough for a real identifier, short enough that the path
 * segment cannot become a payload.
 */
const TOKEN_MAX_LENGTH = 128;

/** The closed answer for every gate: unknown, malformed or blocked token. */
const notFound: ListData = { access: "not_found", gifts: [] };

/**
 * Story 3.3: is `token` exactly one safe path segment? A route param is already
 * one segment, but an encoded slash or backslash (`%2f`, `%5c`) may arrive
 * decoded or not, and a caller may hand over an empty string. Anything that is
 * not one short segment is answered as `not_found` before the database, exactly
 * like an unknown token, and the value is never logged.
 */
function isTokenSegment(token: string): boolean {
  if (token.length === 0 || token.length > TOKEN_MAX_LENGTH) return false;
  if (token.includes("/") || token.includes("\\")) return false;
  const lowered = token.toLowerCase();
  return !lowered.includes("%2f") && !lowered.includes("%5c");
}

/**
 * AD-7 / AD-26: the public read behind `GET /api/v1/l/:token` and the `/l` page.
 * It goes through `readWishlist` only — the single gate — and marks the visitor
 * as arriving through the list token, which is what opens `PUBLIC` gifts to an
 * anonymous or unrelated viewer. `FRIENDS` still needs an accepted friendship,
 * and `SECRET` stays owner-only, because the policy decides and not this action.
 *
 * The viewer is the app session when there is one; a forged or expired cookie is
 * simply no session, so the answer is the anonymous one. AD-27: the request
 * language is negotiated once here, so fixed tag labels match the page.
 *
 * A closed gate keeps the AD-12 success envelope (`ok: true`, `access:
 * "not_found"`): a gate never explains itself, and a block is indistinguishable
 * from an unknown token in body and status.
 */
export async function getWishlistByToken(
  token: string,
  headers: Headers,
): Promise<ActionResult<ListData>> {
  if (!isTokenSegment(token)) return { ok: true, data: listDataSchema.parse(notFound) };

  const session = await auth.api.getSession({ headers });
  const locale = negotiateLocale(preferredFromAcceptLanguage(headers.get("accept-language")));

  const data = await readWishlist({
    viewer: session ? { id: session.user.id } : null,
    target: { publicToken: token },
    viaListToken: true,
    locale,
  });

  return { ok: true, data };
}
