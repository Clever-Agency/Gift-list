import "server-only";

import {
  listDataSchema,
  type ActionResult,
  type ListData,
  type SupportedLocale,
} from "@gift-list/contracts";
import { readWishlist } from "@/actions/wishlist-read";
import { auth } from "@/lib/auth";
import { isPublicTokenSegment } from "@/lib/public-token";
import { requestLocale } from "@/lib/request-locale";
import type { VisibilityViewer } from "@/domain/visibility";

/** The closed answer for every gate: unknown, malformed or blocked token. */
const notFound: ListData = { access: "not_found", gifts: [] };

/**
 * AD-7 / AD-26: one list read behind both `GET /api/v1/l/:token` and the `/l`
 * page. It goes through `readWishlist` only — the single gate — and marks the
 * visitor as arriving through the list token, which is what opens `PUBLIC` gifts
 * to an anonymous or unrelated viewer. `FRIENDS` still needs an accepted
 * friendship, and `SECRET` stays owner-only, because the policy decides and not
 * this action.
 *
 * A malformed token is the same closed `not_found` before the database, so an
 * unknown token, a block and a bad segment stay indistinguishable. The token is
 * never logged.
 */
export async function readPublicWishlist(
  token: string,
  viewer: VisibilityViewer,
  locale: SupportedLocale,
): Promise<ListData> {
  if (!isPublicTokenSegment(token)) return listDataSchema.parse(notFound);

  return readWishlist({
    viewer,
    target: { publicToken: token },
    viaListToken: true,
    locale,
  });
}

/**
 * The `api/v1` adapter of the link read (Story 3.3). The viewer is the app
 * session when there is one; a forged or expired cookie is simply no session,
 * so the answer is the anonymous one. AD-27: the request language is negotiated
 * once here, so fixed tag labels match the page.
 *
 * A closed gate keeps the AD-12 success envelope (`ok: true`, `access:
 * "not_found"`): a gate never explains itself, and a block is indistinguishable
 * from an unknown token in body and status.
 */
export async function getWishlistByToken(
  token: string,
  headers: Headers,
): Promise<ActionResult<ListData>> {
  if (!isPublicTokenSegment(token)) return { ok: true, data: listDataSchema.parse(notFound) };

  const session = await auth.api.getSession({ headers });
  const locale = requestLocale(headers.get("accept-language"));

  const data = await readPublicWishlist(
    token,
    session ? { id: session.user.id } : null,
    locale,
  );

  return { ok: true, data };
}
