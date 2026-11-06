import { getWishlistByToken } from "@/actions/public-wishlist";
import { notFoundResponse, toResponse } from "@/lib/api-v1";

/**
 * Story 3.3 (AD-7, AD-26): the public wishlist read by link token.
 *
 * The token is exactly one path segment, so an optional catch-all is used on
 * purpose: a bare `/api/v1/l`, a trailing slash, a path with extra segments or an
 * encoded slash all reach this handler instead of falling through to the generic
 * API 404. Every one of them is not a token and is answered exactly like an
 * unknown token — same body, same status, no database read and no token in a log.
 *
 * The route is a thin AD-12 adapter; `getWishlistByToken` owns the session, the
 * locale and the single `readWishlist` gate. `toResponse` sets `Cache-Control:
 * private, no-store`, so a shared cache never serves one visitor's answer to
 * another.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token?: string[] }> },
) {
  const { token = [] } = await params;
  // One segment is a token; anything else is the same closed gate as `unknown`.
  const value = token.length === 1 ? (token[0] ?? "") : "";
  return toResponse(await getWishlistByToken(value, request.headers));
}

export const POST = notFoundResponse;
export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;
export const DELETE = notFoundResponse;
