import { undoGiftClose } from "@/actions/gift-close";
import { notFoundResponse, toResponse } from "@/lib/api-v1";

/**
 * Story 5.3 (FR-32, D-43): the owner undoes a close inside the ten-minute
 * window. The body is empty: the id of the route is the whole input, and 200
 * carries the owner's card (with `undoUntil: null`) in the AD-12 envelope. A
 * late undo is 409 with `reason: "UNDO_WINDOW_EXPIRED"`.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return toResponse(await undoGiftClose(request.headers, id));
}

export const GET = notFoundResponse;
export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;
export const DELETE = notFoundResponse;
