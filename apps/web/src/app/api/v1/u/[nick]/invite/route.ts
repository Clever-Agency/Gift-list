import { sendInviteByNick } from "@/actions/friend-invite";
import { notFoundResponse, toResponse } from "@/lib/api-v1";

/**
 * Story 4.1.2 (AD-10, AD-12, ARCH-A12): `POST /api/v1/u/:nick/invite`.
 *
 * The target is exactly one nick segment of the path. The body is not read at
 * all: an arbitrary `userId`, email or list token in it can never select another
 * person. `sendInviteByNick` owns the session, the shared nick normalization,
 * the closed outcomes and the two refusals.
 *
 * `toResponse` sets `Cache-Control: private, no-store`, so a shared cache never
 * replays one user's mutation answer for another.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ nick: string }> },
) {
  const { nick } = await params;
  return toResponse(await sendInviteByNick(nick, request.headers));
}

export const GET = notFoundResponse;
export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;
export const DELETE = notFoundResponse;
