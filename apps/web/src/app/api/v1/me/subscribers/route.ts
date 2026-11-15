import { circleListQuerySchema } from "@gift-list/contracts";

import { listSubscribers } from "@/actions/circle";
import { firstIssueField, notFoundResponse, toResponse } from "@/lib/api-v1";

/**
 * Story 4.3 (AD-19): `GET /api/v1/me/subscribers?cursor=` — who follows the
 * viewer. It is the reverse direction of `/me/subscriptions` and a separate
 * page, because the screen shows «Мои подписчики» apart from «Подписки».
 * Signed-in only; the same query, rows and cursor contract as the friends tab.
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

  return toResponse(await listSubscribers(parsed.data, request.headers));
}

export const POST = notFoundResponse;
export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;
export const DELETE = notFoundResponse;
export const HEAD = notFoundResponse;
