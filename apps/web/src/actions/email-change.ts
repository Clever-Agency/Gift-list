import "server-only";

import {
  rateLimitedError,
  type ActionResult,
  type EmailChangeBody,
} from "@gift-list/contracts";
import { prisma } from "@/db/client";
import { auth } from "@/lib/auth";
import { rememberEmailChangeRequest } from "@/lib/email-change-pending";
import { authRateLimit, consumeRateLimit } from "@/lib/rate-limit";

const unauthenticated = {
  ok: false as const,
  code: "UNAUTHENTICATED" as const,
  message: "Authentication required",
};

/**
 * The page Better Auth sends the browser to after the link is opened, with the
 * outcome in `?error=` on a stale link. A relative path is allowed by its origin
 * check and works for the web build; the app screen reads the same param (T9.2).
 */
const EMAIL_CHANGE_CALLBACK_URL = "/profile?emailChanged=1";

const accepted = { ok: true as const, data: { accepted: true as const } };

/**
 * CLE-129/T9.1 (FR-56, D-58, AD-3): asks Better Auth to move the account to a
 * new address. This only sends the one-time link **to the new address**;
 * `User.email` changes when that link is opened, handled by Better Auth's
 * `/verify-email`. The old address is notified from the `user.update.after` hook
 * (`notifyPreviousEmailAfterChange`) and never before the change is committed.
 *
 * The answer is the same "letter sent" for a free and for a taken address:
 * Better Auth checks the address and, when it belongs to somebody, returns the
 * same neutral `status: true` without sending anything, so this action never
 * says whether the address is free. The rate limit is per user, the same pair of
 * numbers as the rest of auth (`AUTH_RATE_LIMIT_*`), and the raw
 * `/api/auth/change-email` path is closed, so nobody skips it.
 */
export async function requestEmailChange(
  input: EmailChangeBody,
  headers: Headers,
): Promise<ActionResult<{ accepted: true }>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;
  const decision = await consumeRateLimit(`email-change:${session.user.id}`, authRateLimit());
  if (!decision.allowed) {
    return rateLimitedError("Too many email change attempts", decision.retryAfterSeconds);
  }
  const row = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, locale: true },
  });
  if (!row) return unauthenticated;
  const newEmail = input.email.trim().toLowerCase();
  // The user already owns this address, so there is nothing to confirm and no
  // letter to send; the neutral answer keeps the screen behaviour the same.
  if (newEmail === row.email.toLowerCase()) return accepted;
  await rememberEmailChangeRequest({
    userId: row.id,
    oldEmail: row.email,
    newEmail,
    locale: row.locale,
  });
  await auth.api.changeEmail({
    body: { newEmail, callbackURL: EMAIL_CHANGE_CALLBACK_URL },
    headers,
  });
  return accepted;
}
