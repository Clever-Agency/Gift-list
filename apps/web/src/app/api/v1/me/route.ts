import { accountDeletionBodySchema } from "@gift-list/contracts";
import { deleteAccount } from "@/actions/delete-account";
import { getCurrentUser } from "@/actions/current-user";
import { auth } from "@/lib/auth";
import { notFoundResponse, parseJsonBody, toResponse } from "@/lib/api-v1";
import { withAuthSession } from "@/lib/auth-session";

const unauthenticated = {
  ok: false as const,
  code: "UNAUTHENTICATED" as const,
  message: "Authentication required",
};

export async function GET(request: Request) {
  return toResponse(await getCurrentUser(request.headers));
}

/**
 * Story 6.3 (FR-51, AD-20, D-33): self-serve account deletion. The route only
 * checks who is calling and that the client really meant it (`confirm: true`);
 * the one command `deleteAccount` owns the reservations, the holders' notices
 * and every row of the account. The session is checked before the body, so an
 * anonymous request is `UNAUTHENTICATED`, never a validation answer.
 *
 * The command deletes every `Session` row, so the Better Auth sign-out that
 * follows cannot invalidate anything: it only rewrites the cookie as expired
 * for the browser, while an app client drops its bearer token locally
 * (`apps/mobile/src/api/me.ts`). `already-deleted` is success — a retry after a
 * lost answer must not fail. `busy` means the reservations kept moving and the
 * transaction rolled back: nothing was deleted, the cookie stays, retry works.
 */
export async function DELETE(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return toResponse(unauthenticated);

  const parsed = await parseJsonBody(request, accountDeletionBodySchema);
  if (!parsed.ok) return toResponse(parsed);

  const outcome = await deleteAccount(session.user.id);
  if (outcome === "busy") {
    return toResponse({
      ok: false as const,
      code: "CONFLICT" as const,
      message: "Account deletion is in progress, retry",
    });
  }

  const signOut = await auth.api.signOut({
    headers: request.headers,
    asResponse: true,
  });
  return withAuthSession(request, signOut, {
    ok: true,
    data: { deleted: true },
  });
}

export const POST = notFoundResponse;
export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;
export const HEAD = notFoundResponse;
