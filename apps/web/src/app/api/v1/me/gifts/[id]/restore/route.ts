import { restoreGift } from "@/actions/restore-gift";
import { notFoundResponse, parseJson, toResponse } from "@/lib/api-v1";

/** Story 2.6: the owner returns an archived wish. The body is `{ expiresOn }`. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = await parseJson(request);
  if (!parsed.ok) return toResponse(parsed);
  return toResponse(await restoreGift(request.headers, id, parsed.data));
}

export const GET = notFoundResponse;
export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;
export const DELETE = notFoundResponse;
