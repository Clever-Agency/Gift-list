import { reserveGift } from "@/actions/gift-reserve";
import { notFoundResponse, parseJson, toResponse } from "@/lib/api-v1";

/** Story 5.1 (AD-9): CAS reserve `OPEN → RESERVED` with due date and visibility toggles. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = await parseJson(request);
  if (!parsed.ok) return toResponse(parsed);
  return toResponse(await reserveGift(request.headers, id, parsed.data));
}

export const GET = notFoundResponse;
export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;
export const DELETE = notFoundResponse;