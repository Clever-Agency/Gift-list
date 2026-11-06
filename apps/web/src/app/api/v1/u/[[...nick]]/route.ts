import { getProfileByNick } from "@/actions/profile";
import { notFoundResponse, toResponse } from "@/lib/api-v1";

/**
 * Story 3.4.1 (AD-7, AD-12, AD-13): somebody's profile by nick.
 *
 * The nick is exactly one path segment, so an optional catch-all is used on
 * purpose: a bare `/api/v1/u`, a trailing slash, extra segments or an encoded
 * slash all reach this handler instead of the generic API 404. Every one of
 * them is not a nick and gets the same closed `not_found` as an unknown nick.
 *
 * The route is a thin AD-12 adapter; `getProfileByNick` owns the session, the
 * nick normalization, the locale and the single `readWishlist` gate.
 * `toResponse` sets `Cache-Control: private, no-store`, so a shared cache never
 * serves one viewer's answer to another.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ nick?: string[] }> },
) {
  const { nick = [] } = await params;
  // One segment is a nick; anything else is the same closed gate as `unknown`.
  const value = nick.length === 1 ? (nick[0] ?? "") : "";
  return toResponse(await getProfileByNick(value, request.headers));
}

export const POST = notFoundResponse;
export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;
export const DELETE = notFoundResponse;
