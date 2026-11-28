import { getCollection } from "@/actions/collections";
import { notFoundResponse, toResponse } from "@/lib/api-v1";

/**
 * Story 10.1 (CLE-143): one published collection with its ideas. A draft, a
 * future publication and an unknown id are the same `NOT_FOUND` (AD-12).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return toResponse(await getCollection(request.headers, id));
}

export const POST = notFoundResponse;
export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;
export const DELETE = notFoundResponse;
