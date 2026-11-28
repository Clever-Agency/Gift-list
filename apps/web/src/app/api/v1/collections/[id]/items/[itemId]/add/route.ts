import { addCollectionItemToWishlist } from "@/actions/collections";
import { notFoundResponse, toResponse } from "@/lib/api-v1";

/**
 * Story 10.1 / ARCH-A17 (CLE-143): «Добавить в мой вишлист» — an ordinary wish
 * created through the same use-case as `POST /api/v1/me/gifts`, so the caps and
 * the `OPEN` + `PUBLIC` defaults are identical. The answer carries the created
 * card with 201. A draft, a missing collection or a foreign idea id is
 * `NOT_FOUND`.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { id, itemId } = await params;
  return toResponse(await addCollectionItemToWishlist(request.headers, id, itemId), 201);
}

export const GET = notFoundResponse;
export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;
export const DELETE = notFoundResponse;
