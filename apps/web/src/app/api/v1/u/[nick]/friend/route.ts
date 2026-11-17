import { removeFriendByNick } from "@/actions/friend-remove";
import { notFoundResponse, toResponse } from "@/lib/api-v1";

/**
 * Story 4.4 (FR-23, AD-10 step 4): `DELETE /api/v1/u/:nick/friend` — either side
 * of the accepted friendship removes it.
 *
 * The target is exactly one nick segment of the path. The body is not read at
 * all: an arbitrary `userId`, email or list token in it can never select another
 * person. `removeFriendByNick` owns the session, the shared nick normalization,
 * the closed outcomes and the two refusals. Both success outcomes (`REMOVED`,
 * `ALREADY_REMOVED`) are 200.
 *
 * `toResponse` sets `Cache-Control: private, no-store`, so a shared cache never
 * replays one user's mutation answer for another.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ nick: string }> },
) {
  const { nick } = await params;
  return toResponse(await removeFriendByNick(nick, request.headers));
}

export const GET = notFoundResponse;
export const POST = notFoundResponse;
export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;
