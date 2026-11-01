import "server-only";

import type { ActionResult, PasswordForgotBody, PasswordResetBody } from "@gift-list/contracts";
import { auth } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { passwordResetRedirectTo } from "@/lib/password-reset-mail";
import { REGISTER_LIMIT, clientIp, consumeRateLimit } from "@/lib/rate-limit";

const accepted = { ok: true as const, data: { accepted: true as const } };

function staleLink(): ActionResult<{ saved: true }> {
  return {
    ok: false,
    code: "VALIDATION",
    message: "Reset link is stale",
    reason: "RESET_LINK_STALE",
  };
}

const STALE_TOKEN_CODES = new Set(["INVALID_TOKEN", "TOKEN_EXPIRED", "USER_NOT_FOUND"]);
const PASSWORD_RULE_CODES = new Set(["PASSWORD_TOO_SHORT", "PASSWORD_TOO_LONG"]);

function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const record = error as { body?: { code?: unknown }; code?: unknown };
  if (typeof record.body?.code === "string") return record.body.code;
  if (typeof record.code === "string") return record.code;
  return undefined;
}

/**
 * Same body for an existing account and an unknown address (FR-3).
 * Better Auth sends the letter only when the account exists; its body is not forwarded.
 * Resend failures are logged inside the auth callback and do not change this result.
 */
export async function requestPasswordReset(
  input: PasswordForgotBody,
  headers: Headers,
): Promise<ActionResult<{ accepted: true }>> {
  const allowed = await consumeRateLimit(`password-forgot:${clientIp(headers)}`, REGISTER_LIMIT);
  if (!allowed) {
    return { ok: false, code: "RATE_LIMITED", message: "Too many password reset attempts" };
  }
  await auth.api.requestPasswordReset({
    body: {
      email: input.email,
      redirectTo: passwordResetRedirectTo(getEnv().BETTER_AUTH_URL),
    },
    headers,
  });
  return accepted;
}

/**
 * Sets the password through Better Auth. A live but too-short password is rejected
 * before the token is spent. A missing, expired, or already used token is `RESET_LINK_STALE`.
 * This does not open a session.
 */
export async function resetPassword(input: PasswordResetBody): Promise<ActionResult<{ saved: true }>> {
  if (input.token.trim().length === 0) return staleLink();
  try {
    const result = await auth.api.resetPassword({
      body: { newPassword: input.password, token: input.token },
    });
    if (!result?.status) return staleLink();
    return { ok: true, data: { saved: true } };
  } catch (error) {
    if (PASSWORD_RULE_CODES.has(errorCode(error) ?? "")) {
      return { ok: false, code: "VALIDATION", message: "Invalid input", field: "password" };
    }
    if (STALE_TOKEN_CODES.has(errorCode(error) ?? "")) return staleLink();
    throw error;
  }
}
