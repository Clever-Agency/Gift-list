import { circleInvitesQuerySchema } from "@gift-list/contracts";

import { listInvites } from "@/actions/circle";
import { firstIssueField, notFoundResponse, toResponse } from "@/lib/api-v1";

/**
 * Story 4.3 (AD-10): `GET /api/v1/me/invites?incomingCursor=&outgoingCursor=`.
 *
 * One response carries both halves of the «Запросы» tab as separate pages and
 * the full incoming count for the badge; each half has its own opaque cursor.
 * Signed-in only. A cursor the domain did not issue is the `VALIDATION`
 * envelope with the name of that half's parameter.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = circleInvitesQuerySchema.safeParse({
    incomingCursor: searchParams.get("incomingCursor") ?? undefined,
    outgoingCursor: searchParams.get("outgoingCursor") ?? undefined,
  });
  if (!parsed.success) {
    return toResponse({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: firstIssueField(parsed.error),
    });
  }

  return toResponse(await listInvites(parsed.data, request.headers));
}

export const POST = notFoundResponse;
export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;
export const DELETE = notFoundResponse;
export const HEAD = notFoundResponse;
