import "server-only";

import { createHash } from "node:crypto";
import { rateLimitedError, safeNextPath, type LoginBody } from "@gift-list/contracts";
import { prisma } from "@/db/client";
import { auth } from "@/lib/auth";
import { authRateLimit, clientIp, consumeRateLimit } from "@/lib/rate-limit";
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
 * Each attempt takes a slot before the password is checked (same window as registration).
 * A limited response does not say which key fired and does not contain the address.
 */
export async function signInUser(input: LoginBody, headers: Headers): Promise<AuthOutcome> {
  const limited = await signInLimit(input.email, headers);
  if (limited) return { result: limited };

  const session = await auth.api.signInEmail({
    body: { email: input.email, password: input.password },
    headers,
    asResponse: true,
  });
  if (!session.ok) return { result: invalidLogin };

  const row = await prisma.user.findUnique({
    where: { email: input.email },
    select: {
      id: true,
      email: true,
      name: true,
      nick: true,
      timeZone: true,
      hideFromSearch: true,
    },
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
          hideFromSearch: row.hideFromSearch,
        },
        next: safeNextPath(input.next),
      },
    },
    session,
  };
}

async function signInLimit(email: string, headers: Headers) {
  const limit = authRateLimit();
  const ip = await consumeRateLimit(`sign-in:${clientIp(headers)}`, limit);
  if (!ip.allowed) return rateLimitedError("Too many sign-in attempts", ip.retryAfterSeconds);
  const byEmail = await consumeRateLimit(signInEmailKey(email), limit);
  if (!byEmail.allowed) return rateLimitedError("Too many sign-in attempts", byEmail.retryAfterSeconds);
  return undefined;
}

/** The address is not stored: the row outlives the window, including for an unknown mailbox. */
function signInEmailKey(email: string): string {
  return `sign-in-email:${createHash("sha256").update(email).digest("hex")}`;
}
