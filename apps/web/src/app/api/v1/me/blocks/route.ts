import { blockedListQuerySchema } from "@gift-list/contracts";

import { listBlocked } from "@/actions/block";
import { firstIssueField, notFoundResponse, toResponse } from "@/lib/api-v1";

/**
 * Story 4.5.2 (AD-10 step 4): `GET /api/v1/me/blocks?cursor=` — the people the
 * viewer blocked, as their own page. Only the viewer's directed rows are read,
 * so a person who blocked the viewer never appears here. Signed-in only; the
 * same opaque cursor contract as the other `/me/*` lists, and no search, because
 * the «Заблокированные» section has no query field: the query object is strict,
 * so an unknown parameter is `VALIDATION`, not a silently ignored filter.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = blockedListQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return toResponse({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: firstIssueField(parsed.error),
    });
  }

  return toResponse(await listBlocked(parsed.data, request.headers));
}

export const POST = notFoundResponse;
export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;
export const DELETE = notFoundResponse;
export const HEAD = notFoundResponse;
