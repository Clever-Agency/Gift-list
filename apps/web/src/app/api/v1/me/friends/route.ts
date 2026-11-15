import { circleListQuerySchema } from "@gift-list/contracts";

import { listFriends } from "@/actions/circle";
import { firstIssueField, notFoundResponse, toResponse } from "@/lib/api-v1";

/**
 * Story 4.3 (AD-10, AD-13): `GET /api/v1/me/friends?q=&cursor=`.
 *
 * The query is parsed by the shared contract schema: an absent or blank `q` is
 * the whole circle, only an over-long or control-character query is VALIDATION,
 * and the opaque cursor is passed through to the domain. Signed-in only; a
 * broken cursor becomes the same `VALIDATION` envelope with `field: "cursor"`.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = circleListQuerySchema.safeParse({
    q: searchParams.get("q") ?? undefined,
    cursor: searchParams.get("cursor") ?? undefined,
  });
  if (!parsed.success) {
    return toResponse({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: firstIssueField(parsed.error),
    });
  }

  return toResponse(await listFriends(parsed.data, request.headers));
}

export const POST = notFoundResponse;
export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;
export const DELETE = notFoundResponse;
export const HEAD = notFoundResponse;
