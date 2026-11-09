import { rejectInviteByNick } from "@/actions/friend-invite";
import { notFoundResponse, toResponse } from "@/lib/api-v1";

/**
 * Story 4.2.2 (FR-14, AD-10 step 3): `POST /api/v1/u/:nick/invite/reject`.
 *
 * The inviter is exactly one nick segment of the path; the session user is the
 * recipient. The body is not read at all. `rejectInviteByNick` owns the session,
 * the shared nick normalization, the recipient-only domain protocol and the
 * closed `REJECTED` acknowledgement.
 *
 * `toResponse` sets `Cache-Control: private, no-store`, so a shared cache never
 * replays one user's mutation answer for another.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ nick: string }> },
) {
  const { nick } = await params;
  return toResponse(await rejectInviteByNick(nick, request.headers));
}

export const GET = notFoundResponse;
export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;
export const DELETE = notFoundResponse;
