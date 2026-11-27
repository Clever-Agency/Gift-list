import { personalDateUpdateBodySchema } from "@gift-list/contracts";
import { deleteMyDate, updateMyDate } from "@/actions/personal-dates";
import { notFoundResponse, parseJsonBody, toResponse } from "@/lib/api-v1";

/**
 * Story 7.5 (FR-38, AD-23): one own personal date. `PATCH` edits it and answers
 * the updated row; `DELETE` removes it and answers its id. A date of somebody
 * else is the closed `NOT_FOUND`, indistinguishable from an unknown id. The
 * edit screen reads the row from `GET /api/v1/me/dates`, so this route has no
 * `GET` of its own.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = await parseJsonBody(request, personalDateUpdateBodySchema);
  if (!parsed.ok) return toResponse(parsed);
  return toResponse(await updateMyDate(request.headers, id, parsed.data));
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return toResponse(await deleteMyDate(request.headers, id));
}

export const GET = notFoundResponse;
export const POST = notFoundResponse;
export const PUT = notFoundResponse;
export const HEAD = notFoundResponse;
