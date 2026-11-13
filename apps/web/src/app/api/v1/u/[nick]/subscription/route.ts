import { subscribeByNick, unsubscribeByNick } from "@/actions/subscription";
import { notFoundResponse, toResponse } from "@/lib/api-v1";

/**
 * Story 4.6 (FR-46, AD-19): `POST /api/v1/u/:nick/subscription` subscribes the
 * session user to the nick's owner; `DELETE` of the same path removes that same
 * directed row (the subscriber unsubscribes).
 *
 * The target is exactly one nick segment of the path. The body is not read at
 * all: an arbitrary `userId` or a token in it can never select another person.
 * The actions own the session, the shared nick normalization, the closed
 * outcomes and the refusals; a repeat of either call is a successful no-op.
 *
 * `toResponse` sets `Cache-Control: private, no-store`, so a shared cache never
 * replays one user's mutation answer for another.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ nick: string }> },
) {
  const { nick } = await params;
  return toResponse(await subscribeByNick(nick, request.headers));
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ nick: string }> },
) {
  const { nick } = await params;
  return toResponse(await unsubscribeByNick(nick, request.headers));
}

export const GET = notFoundResponse;
export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;
