import { closeGift } from "@/actions/gift-close";
import { notFoundResponse, toResponse } from "@/lib/api-v1";

/**
 * Story 5.3 (FR-32, AD-8): the owner marks a wish as received. The body is
 * empty: the transition needs nothing but the session and the route id, and 200
 * carries the owner's card with `undoUntil` in the AD-12 envelope.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return toResponse(await closeGift(request.headers, id));
}

export const GET = notFoundResponse;
export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;
export const DELETE = notFoundResponse;
