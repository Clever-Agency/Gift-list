import "server-only";

import { APIError } from "better-auth/api";
import {
  isEmailChangeLinkStillPending,
  readEmailChangeLinkClaim,
} from "@/lib/email-change-pending";

/**
 * CLE-129/T9.2a (FR-56, AD-3): «Отменить» in the waiting block removes the
 * pending row, but the letter with the one-time link is already in the mailbox.
 * Better Auth's `/verify-email` would still apply that link for up to an hour,
 * silently moving the account and notifying nobody on the old address. This
 * guard runs before the handler and answers a link whose request is no longer
 * pending with the same `?error=INVALID_TOKEN` redirect the screens already read
 * (T9.2), so the address never changes.
 *
 * The same check also refuses a superseded link: a newer request replaces the
 * row, so a link that points at another address no longer matches.
 */
const INVALID_TOKEN = "INVALID_TOKEN";

type VerifyEmailHookContext = {
  path: string;
  query?: Record<string, unknown>;
  redirect(url: string): unknown;
};

/** Relative callback only: a rejected link must not become an open redirect. */
function safeCallbackURL(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

/** `?error=` goes into the existing query of the callback, before any `#`. */
export function callbackWithError(callbackURL: string, code: string): string {
  const hashIndex = callbackURL.indexOf("#");
  const base = hashIndex === -1 ? callbackURL : callbackURL.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : callbackURL.slice(hashIndex);
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}error=${encodeURIComponent(code)}${hash}`;
}

/**
 * Registered as `hooks.before` in `lib/auth.ts`. Only `/verify-email` links that
 * carry `updateTo` are change-email links; a plain address verification has no
 * pending row and is left alone.
 */
export async function guardEmailChangeVerification(
  ctx: VerifyEmailHookContext,
): Promise<void> {
  if (ctx.path !== "/verify-email") return;
  const token = ctx.query?.token;
  if (typeof token !== "string") return;
  const claim = readEmailChangeLinkClaim(token);
  if (claim === null) return;
  if (await isEmailChangeLinkStillPending(claim)) return;
  const callbackURL = safeCallbackURL(ctx.query?.callbackURL);
  if (callbackURL === null) {
    throw new APIError("UNAUTHORIZED", { message: "Invalid token", code: INVALID_TOKEN });
  }
  throw ctx.redirect(callbackWithError(callbackURL, INVALID_TOKEN));
}
