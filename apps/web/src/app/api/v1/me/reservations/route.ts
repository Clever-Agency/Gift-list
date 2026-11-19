import { getMyReservations } from "@/actions/my-reservations";
import { notFoundResponse, toResponse } from "@/lib/api-v1";

/** Story 5.5 (FR-25, A-14): the holder's own reservation cards. */
export async function GET(request: Request) {
  return toResponse(await getMyReservations(request.headers));
}

export const POST = notFoundResponse;
export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;
export const DELETE = notFoundResponse;
