import { getGift, updateGift } from "@/actions/gifts";
import { notFoundResponse, parseJson, toResponse } from "@/lib/api-v1";

/** Story 2.2 (FR-10): the edit screen loads one wish of the owner's list; 200 carries the card (AD-12). */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return toResponse(await getGift(request.headers, id));
}

/** Story 2.2 (FR-10): the owner edits a wish of their own list; 200 carries the card (AD-12). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = await parseJson(request);
  if (!parsed.ok) return toResponse(parsed);
  return toResponse(await updateGift(request.headers, id, parsed.data));
}

export const POST = notFoundResponse;
export const PUT = notFoundResponse;
export const DELETE = notFoundResponse;
