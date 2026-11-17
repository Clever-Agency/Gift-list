import { userSearchQuerySchema } from "@gift-list/contracts";

import { searchUsers } from "@/actions/search-users";
import { firstIssueField, notFoundResponse, toResponse } from "@/lib/api-v1";

/**
 * Story 3.5 (AD-13, AD-27): `GET /api/v1/search?q=...` finds people by nick
 * (exact or prefix) or display name (fuzzy). Signed-in only; the phone-book
 * endpoint is separate (AD-18). An absent or empty `q` is a successful empty
 * list, and only a query over the cap or with control characters is VALIDATION.
 */
export async function GET(request: Request) {
  const parsed = userSearchQuerySchema.safeParse({
    q: new URL(request.url).searchParams.get("q") ?? "",
  });
  if (!parsed.success) {
    return toResponse({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: firstIssueField(parsed.error),
    });
  }

  return toResponse(await searchUsers(parsed.data, request.headers));
}

export const POST = notFoundResponse;
export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;
export const DELETE = notFoundResponse;
export const HEAD = notFoundResponse;
