import { createGift } from "@/actions/gifts";
import { getMyGifts } from "@/actions/my-gifts";
import { notFoundResponse, parseJson, toResponse } from "@/lib/api-v1";

export async function GET(request: Request) {
  return toResponse(await getMyGifts(request.headers));
}

/** Story 2.2 (FR-10): the owner adds a wish; 201 carries the created card (AD-12). */
export async function POST(request: Request) {
  const parsed = await parseJson(request);
  if (!parsed.ok) return toResponse(parsed);
  return toResponse(await createGift(request.headers, parsed.data), 201);
}

export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;
export const DELETE = notFoundResponse;
