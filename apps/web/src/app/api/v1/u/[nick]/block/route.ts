import { blockUserByNick, unblockUserByNick } from "@/actions/block";
import { notFoundResponse, toResponse } from "@/lib/api-v1";

/**
 * Story 4.5 (FR-24, AD-10 step 4): `POST /api/v1/u/:nick/block` blocks the
 * nick's owner for the session user; `DELETE` of the same path removes that own
 * block (the session user unblocks). `POST` follows the neighbour
 * `/api/v1/u/:nick/subscription`, which also creates its directed row with
 * `POST`, so the two pair mutations of one nick speak the same method.
 *
 * The target is exactly one nick segment of the path. The body is not read at
 * all: an arbitrary `userId` or a token in it can never select another person.
 * The actions own the session, the direct nick resolution, the closed outcomes
 * and the refusals; a repeat of either call is a successful no-op (200).
 *
 * `toResponse` sets `Cache-Control: private, no-store`, so a shared cache never
 * replays one user's mutation answer for another.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ nick: string }> },
) {
  const { nick } = await params;
  return toResponse(await blockUserByNick(nick, request.headers));
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ nick: string }> },
) {
  const { nick } = await params;
  return toResponse(await unblockUserByNick(nick, request.headers));
}

export const GET = notFoundResponse;
export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;
