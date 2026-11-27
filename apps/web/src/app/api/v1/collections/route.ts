import { listCollections } from "@/actions/collections";
import { notFoundResponse, toResponse } from "@/lib/api-v1";

/**
 * Story 10.1 (CLE-143): published editorial collections for the app. Signed-in
 * only, like every `/me` read; drafts and a future publication never reach the
 * answer (AD-22). Other methods answer the closed `NOT_FOUND` envelope.
 */
export async function GET(request: Request) {
  return toResponse(await listCollections(request.headers));
}

export const POST = notFoundResponse;
export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;
export const DELETE = notFoundResponse;
