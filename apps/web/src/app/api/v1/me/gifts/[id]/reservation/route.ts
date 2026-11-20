import { previewReservationRelease, releaseReservationAsOwner } from "@/actions/gift-release";
import { notFoundResponse, toResponse } from "@/lib/api-v1";

/**
 * Story 5.2 (FR-31, AD-12): the owner's preflight before releasing somebody
 * else's reservation. The answer is `{ warning }` and nothing else — no holder,
 * no due date, no phase, no `bought`; a foreign or unknown id answers the same
 * NOT_FOUND body as `/me/gifts/[id]/visibility`. The preflight only reads, so a
 * stale `null` is harmless: the DELETE decides on its own.
 *
 * Story 5.4: the delete of a reserved wish reads the same answer (AD-7 gives the
 * owner one warning for both releasing and deleting), so no second route exists.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return toResponse(await previewReservationRelease(request.headers, id));
}

/**
 * Story 5.2 (FR-17, AD-8, AD-9): the owner releases a foreign reservation
 * through the same CAS as the holder. There is no body; a lost CAS is a
 * CONFLICT, a foreign or unknown id stays the same NOT_FOUND body.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return toResponse(await releaseReservationAsOwner(request.headers, id));
}

/** Only the owner's preflight and release exist; every other method keeps the AD-12 NOT_FOUND envelope. */
export const POST = notFoundResponse;
export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;
