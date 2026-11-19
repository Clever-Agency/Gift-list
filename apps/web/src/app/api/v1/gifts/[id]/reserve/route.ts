import { releaseMyReservation } from "@/actions/gift-release";
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
  const listToken = new URL(request.url).searchParams.get("listToken");
  return toResponse(await reserveGift(request.headers, id, parsed.data, listToken));
}

/**
 * Story 5.2 (FR-17, AD-7, AD-9): the holder releases their own reservation
 * through the same path as the reserve. There is no body and no `listToken`: the
 * use-case finds the holder's live reservation on its own and answers `{ id }`,
 * so the route never reads what it does not use.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return toResponse(await releaseMyReservation(request.headers, id));
}

export const GET = notFoundResponse;
export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;