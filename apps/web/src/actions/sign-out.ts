import "server-only";

import type { ActionResult } from "@gift-list/contracts";
import { prisma } from "@/db/client";
import { auth } from "@/lib/auth";

export type SignOutOutcome = {
  result: ActionResult<{ signedOut: true }>;
  session?: Response;
};

/**
 * Drops this client's session row and asks Better Auth to clear the cookie.
 * A missing session is still success: logout is idempotent.
 */
export async function signOutUser(headers: Headers): Promise<SignOutOutcome> {
  const current = await auth.api.getSession({ headers });
  if (current) {
    await prisma.session.deleteMany({ where: { token: current.session.token } });
  }
  const session = await auth.api.signOut({ headers, asResponse: true });
  return { result: { ok: true, data: { signedOut: true } }, session };
}
