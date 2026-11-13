import { removeSubscriberByNick } from "@/actions/subscription";
import { notFoundResponse, toResponse } from "@/lib/api-v1";

/**
 * Story 4.6 (AD-19): `DELETE /api/v1/u/:nick/subscribers/:subscriberNick` is
 * the profile owner removing one subscriber. `:nick` is the owner (the session
 * user must be that person) and `:subscriberNick` is the directed edge's
 * subscriber, so the deleted row is always `subscriberNick → nick`.
 *
 * This is a mutation of one row, not a read: the subscriber list and the
 * «Подписки» tab belong to Story 4.3, and `GET` stays the closed 404 here. The
 * body is not read at all. A repeat is a successful no-op.
 *
 * `toResponse` sets `Cache-Control: private, no-store`.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ nick: string; subscriberNick: string }> },
) {
  const { nick, subscriberNick } = await params;
  return toResponse(await removeSubscriberByNick(nick, subscriberNick, request.headers));
}

export const GET = notFoundResponse;
export const POST = notFoundResponse;
export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;
