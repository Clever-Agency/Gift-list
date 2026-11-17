import { getInvitePreview } from "@/actions/invite-link";
import { notFoundResponse, toResponse } from "@/lib/api-v1";

/**
 * Story 4.7 (FR-47, AD-21): `GET /api/v1/i/:token` — the read-only preview of an
 * invite link. A guest is answered, so a signed-out visitor and a messenger
 * preview both work; a signed-in viewer also learns their closed relation.
 *
 * The token is exactly one path segment. A bare `/api/v1/i`, a trailing slash or
 * extra segments never reach this handler and fall through to the generic API
 * 404, which is the same AD-12 envelope. The route is a thin AD-12 adapter: the
 * action owns the session, the segment gate and the no-write preview.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  return toResponse(await getInvitePreview(token, request.headers));
}

export const POST = notFoundResponse;
export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;
export const DELETE = notFoundResponse;
export const HEAD = notFoundResponse;
