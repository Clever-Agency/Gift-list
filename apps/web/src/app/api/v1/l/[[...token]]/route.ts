import { getWishlistByToken } from "@/actions/public-wishlist";
import { notFoundResponse, toResponse } from "@/lib/api-v1";

/**
 * Story 3.3 (AD-7, AD-26): the public wishlist read by link token.
 *
 * The token is exactly one path segment, so an optional catch-all is used on
 * purpose: the canonical bare `/api/v1/l`, extra segments and malformed tokens
 * get the same refusal as an unknown token, before any session or database read.
 * Next.js redirects `/api/v1/l/` to `/api/v1/l` with HTTP 308 before this handler.
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
