import "server-only";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/db/client";

/** What one call may do: the current ADMIN and their id, or the closed refusal. */
export type AdminGate =
  | { readonly ok: true; readonly userId: string }
  | { readonly ok: false };

/**
 * Story 10.1 / AD-22: `/admin` is for the ADMIN role only, and every page and
 * every server action checks it again — never the page once for the action.
 *
 * The role comes from the database, not from a session field: a role removed
 * from the account closes `/admin` immediately. An anonymous visitor, a USER
 * and a missing account all get the same closed answer, so the page answers
 * `notFound()` without a sign-in form and never reveals that `/admin` exists.
 *
 * Pages call it without arguments (`headers()` from the request scope); a route
 * handler or an action may pass its own headers.
 */
export async function requireAdmin(requestHeaders?: Headers): Promise<AdminGate> {
  const resolvedHeaders = requestHeaders ?? (await headers());

  const session = await auth.api.getSession({ headers: resolvedHeaders });
  if (!session) return { ok: false };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== "ADMIN") return { ok: false };

  return { ok: true, userId: session.user.id };
}
