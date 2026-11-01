import "server-only";

import { safeNextPath, type LoginBody } from "@gift-list/contracts";
import { prisma } from "@/db/client";
import { auth } from "@/lib/auth";
import { storedTimeZone } from "@/lib/time-zone";
import type { AuthOutcome } from "@/actions/register";

const invalidLogin = {
  ok: false as const,
  code: "UNAUTHENTICATED" as const,
  message: "Invalid email or password",
};

/**
 * Email and password sign-in. Unknown email and a wrong password share one response (FR-2).
 * Better Auth already returns the same error for both; the body is not forwarded.
 */
export async function signInUser(input: LoginBody, headers: Headers): Promise<AuthOutcome> {
  const session = await auth.api.signInEmail({
    body: { email: input.email, password: input.password },
    headers,
    asResponse: true,
  });
  if (!session.ok) return { result: invalidLogin };

  const row = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, email: true, name: true, nick: true, timeZone: true },
  });
  if (!row) return { result: invalidLogin };

  return {
    result: {
      ok: true,
      data: {
        user: {
          id: row.id,
          email: row.email,
          name: row.name,
          nick: row.nick,
          timeZone: storedTimeZone(row.timeZone),
        },
        next: safeNextPath(input.next),
      },
    },
    session,
  };
}
