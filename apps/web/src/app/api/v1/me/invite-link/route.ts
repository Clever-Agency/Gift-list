import { getMyInviteLink } from "@/actions/invite-link";
import { notFoundResponse, toResponse } from "@/lib/api-v1";

/**
 * Story 4.7 (FR-47, AD-21): `GET /api/v1/me/invite-link` — the session user's one
 * immutable invite token from storage. Signed-in only; the action owns the session
 * and a read-only lookup.
 *
 * `toResponse` sets `Cache-Control: private, no-store`, so one user's link is
 * never served from a shared cache to another.
 */
export async function GET(request: Request) {
  return toResponse(await getMyInviteLink(request.headers));
}

export const POST = notFoundResponse;
export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;
export const DELETE = notFoundResponse;
export const HEAD = notFoundResponse;
