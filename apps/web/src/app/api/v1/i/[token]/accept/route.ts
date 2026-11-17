import { acceptInviteByToken } from "@/actions/invite-link";
import { notFoundResponse, toResponse } from "@/lib/api-v1";

/**
 * Story 4.7 (FR-47, AD-21): `POST /api/v1/i/:token/accept` — the signed-in viewer
 * confirms the invite link. The body is not read at all: the token in the path is
 * the whole input, so no client-supplied id can select another person.
 *
 * The action owns the session, the segment gate, the pair-lock transaction and
 * the closed answers: 200 `FRIENDS` / `ALREADY_FRIENDS`, 403 for the viewer's own
 * link, 404 for an unknown token or a `Block` in either direction.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  return toResponse(await acceptInviteByToken(token, request.headers));
}

export const GET = notFoundResponse;
export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;
export const DELETE = notFoundResponse;
export const HEAD = notFoundResponse;
