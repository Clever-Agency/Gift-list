import { emailChangeBodySchema } from "@gift-list/contracts";
import { cancelEmailChange, requestEmailChange } from "@/actions/email-change";
import { notFoundResponse, parseJsonBody, toResponse } from "@/lib/api-v1";

/**
 * CLE-129/T9.1 (FR-56, D-58, AD-3): the request that starts an email change.
 * The new address receives the one-time link; the account keeps its old address
 * until that link is opened (`/api/auth/verify-email`). The raw Better Auth
 * `/api/auth/change-email` path is closed, so the per-user limit of this route
 * cannot be skipped.
 *
 * `DELETE` (T9.2) is «Отменить» of the waiting block: it forgets the pending
 * wish, so the old address is not notified later.
 */
export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, emailChangeBodySchema);
  if (!parsed.ok) return toResponse(parsed);
  return toResponse(await requestEmailChange(parsed.data, request.headers));
}

export async function DELETE(request: Request) {
  return toResponse(await cancelEmailChange(request.headers));
}

export const GET = notFoundResponse;
export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;
export const HEAD = notFoundResponse;
