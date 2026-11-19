import "server-only";

import { createId } from "@paralleldrive/cuid2";
import { hashPassword } from "better-auth/crypto";
import {
  negotiateLocale,
  newPasswordLengthReason,
  normalizeForSearch,
  preferredFromAcceptLanguage,
  rateLimitedError,
  safeNextPath,
  type ActionResult,
  type Me,
  type RegisterBody,
} from "@gift-list/contracts";
import { prisma } from "@/db/client";
import { Prisma } from "@/db/generated/client";
import { acceptInviteLinkInTransaction } from "@/domain/invite-link";
import { normalizeNick } from "@/domain/nick";
import { auth } from "@/lib/auth";
import { isPasswordPwnedFailOpen } from "@/lib/hibp-password";
import { inviteLinkTransaction } from "@/lib/invite-link-store";
import { authRateLimit, clientIp, consumeRateLimit } from "@/lib/rate-limit";

export type AuthPayload = { user: Me; next: string };

export type AuthOutcome = {
  result: ActionResult<AuthPayload>;
  session?: Response;
};

type RegisterValidationReason = "EMAIL_TAKEN" | "NICK_TAKEN" | "PASSWORD_TOO_SHORT" | "PASSWORD_TOO_LONG" | "PASSWORD_PWNED";

function validation(field?: string, reason?: RegisterValidationReason): ActionResult<AuthPayload> {
  return {
    ok: false,
    code: "VALIDATION",
    message: "Invalid input",
    ...(field ? { field } : {}),
    ...(reason ? { reason } : {}),
  };
}

/**
 * Creates the user, the credential account, exactly one list and the user's own
 * invite link in one transaction (AD-6, AD-21), then opens a Better Auth session.
 * `accountId` matches `user.id` so `signInEmail` finds it.
 *
 * A valid `inviteToken` adds the friendship with the link owner to the same
 * transaction (AD-21): User, List, InviteLink and Friendship commit or roll back
 * together, so a failed friendship write leaves no account either. An unknown
 * token or a `Block` is a closed refusal of the domain that registration ignores
 * — the account is still created without a friendship, and the answer is the
 * same as a registration with an unknown token (CLE-99, AD-21). When that body
 * carried `inviteToken`, a `next` pointing at the invite screen is replaced with
 * `/` («Мой вишлист»): opening that screen would show «Приглашение не найдено.»,
 * and a different `next` for a `Block` would reveal it. A body without
 * `inviteToken` keeps the requested path. A `next` pointing at `/l/:token` never
 * creates a friendship or a subscription, even when the body carries a token
 * (AD-15-11).
 */
export async function registerUser(input: RegisterBody, headers: Headers): Promise<AuthOutcome> {
  const decision = await consumeRateLimit(`register:${clientIp(headers)}`, authRateLimit());
  if (!decision.allowed) {
    return {
      result: rateLimitedError("Too many registration attempts", decision.retryAfterSeconds),
    };
  }

  const { email, password, displayName } = input;
  const lengthReason = newPasswordLengthReason(password);
  if (lengthReason) {
    return { result: validation("password", lengthReason) };
  }
  // AD-13: `nick` is stored only in its canonical form, and the lookup below
  // uses the same value, so a case or padding variant can never slip past the
  // unique index even if the caller skipped the body schema.
  const nick = normalizeNick(input.nick);
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { nickNormalized: nick }] },
    select: { email: true, nickNormalized: true },
  });
  if (existing) {
    return { result: conflict(existing.email === email, existing.nickNormalized === nick) };
  }
  if (await isPasswordPwnedFailOpen(password)) {
    return { result: validation("password", "PASSWORD_PWNED") };
  }

  const userId = createId();
  const locale = negotiateLocale(preferredFromAcceptLanguage(headers.get("accept-language")));
  const passwordHash = await hashPassword(password);
  const requestedNext = safeNextPath(input.next);
  // AD-15-11: a registration that came through a list link `/l/:token` never
  // creates a friendship, even if a body also carries an invite token — only the
  // `/i/` path does. `safeNextPath` has already rewritten `/l/x` to `/wishlist/x`.
  const inviteToken = requestedNext.startsWith("/wishlist/") ? undefined : input.inviteToken;
  let joined = false;
  try {
    await prisma.$transaction(
      async function createAccount(tx) {
        // AD-21: the token is resolved inside the registration transaction, so a
        // stale, foreign or blocked link can only mean "no friendship", never a
        // failed registration.
        const invite = inviteLinkTransaction(tx);
        const owner = inviteToken === undefined ? null : await invite.findOwnerByToken(inviteToken);

        await tx.user.create({
          data: {
            id: userId,
            name: displayName,
            nameNormalized: normalizeForSearch(displayName),
            email,
            nick,
            nickNormalized: nick,
            locale,
            accounts: {
              create: {
                accountId: userId,
                providerId: "credential",
                password: passwordHash,
              },
            },
            lists: {
              create: { publicToken: createId() },
            },
            inviteLink: {
              create: { token: createId() },
            },
          },
        });

        if (owner !== null) {
          const accepted = await acceptInviteLinkInTransaction({ viewerId: userId, owner }, invite);
          joined = accepted.ok;
        }
      },
      // The accept takes the same pair lock as every friendship write, so the
      // transaction is pinned to the isolation that lock was designed for.
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const taken = await prisma.user.findFirst({
        where: { OR: [{ email }, { nickNormalized: nick }] },
        select: { email: true, nickNormalized: true },
      });
      // A unique failure that left no user row is not an email/nick conflict —
      // the whole registration transaction rolled back, so the caller must see
      // the failure instead of a validation answer.
      if (taken === null) throw error;
      return { result: conflict(taken.email === email, taken.nickNormalized === nick) };
    }
    throw error;
  }

  const session = await auth.api.signInEmail({
    body: { email, password },
    headers,
    asResponse: true,
  });
  const user: Me = {
    id: userId,
    email,
    name: displayName,
    nick,
    timeZone: null,
    hideFromSearch: false,
  };
  const result: ActionResult<AuthPayload> = {
    ok: true,
    data: { user, next: nextAfterClosedInvite(requestedNext, joined, inviteToken !== undefined) },
  };
  if (!session.ok) {
    return {
      result: { ok: false, code: "UNAUTHENTICATED", message: "Sign-in after registration failed" },
    };
  }
  return { result, session };
}

/**
 * CLE-99: a registration that tried an invite token and did not create the
 * friendship must not return to `/invite/:token`. That screen answers a block
 * and an unknown token with the same «not found». Both refusals therefore share
 * `next: "/"` («Мой вишлист»). A created friendship keeps the requested path,
 * including a query. A body without `inviteToken` keeps it too — the screen can
 * still offer «Добавить». Every other path, including `/wishlist/:token`, is
 * unchanged. A different `next` for a block alone would reveal it (AD-21).
 */
function nextAfterClosedInvite(requested: string, joined: boolean, attempted: boolean): string {
  if (joined || !attempted) return requested;
  const path = requested.split(/[?#]/, 1)[0] ?? requested;
  return /^\/invite\/[^/]+$/.test(path) ? "/" : requested;
}

function conflict(emailTaken: boolean, nickTaken: boolean): ActionResult<AuthPayload> {
  if (emailTaken) return validation("email", "EMAIL_TAKEN");
  return nickTaken ? validation("nick", "NICK_TAKEN") : validation();
}
