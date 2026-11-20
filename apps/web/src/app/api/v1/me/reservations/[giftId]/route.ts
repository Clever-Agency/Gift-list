import { updateMyReservation } from "@/actions/reservation-update";
import { notFoundResponse, parseJson, toResponse } from "@/lib/api-v1";

/**
 * Story 5.5 (FR-25, FR-29…FR-31, AD-7, AD-9): one action per request on the
 * holder's own reservation — `extend { dueOn }`, `bought { value }` or
 * `visibility { holderVisibleToOwner, holderVisibleToOthers }`. The body is a
 * closed discriminated union, so two actions or an extra key are VALIDATION; the
 * answer is the updated reservation card. Removing a reservation stays with
 * `DELETE /api/v1/gifts/:id/reserve` (Story 5.2).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ giftId: string }> },
) {
  const { giftId } = await params;
  const parsed = await parseJson(request);
  if (!parsed.ok) return toResponse(parsed);
  return toResponse(await updateMyReservation(request.headers, giftId, parsed.data));
}

/** Only the holder's one action exists; every other method keeps the AD-12 NOT_FOUND envelope. */
export const GET = notFoundResponse;
export const POST = notFoundResponse;
export const PUT = notFoundResponse;
export const DELETE = notFoundResponse;
