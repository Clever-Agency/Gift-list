import "server-only";

import { createId } from "@paralleldrive/cuid2";
import { hashPassword } from "better-auth/crypto";
import {
  negotiateLocale,
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
import { inviteLinkTransaction } from "@/lib/invite-link-store";
import { authRateLimit, clientIp, consumeRateLimit } from "@/lib/rate-limit";

export type AuthPayload = { user: Me; next: string };

export type AuthOutcome = {
  result: ActionResult<AuthPayload>;
  session?: Response;
};

function validation(field?: string, reason?: "EMAIL_TAKEN" | "NICK_TAKEN"): ActionResult<AuthPayload> {
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
 * same as a registration without a token. A `next` pointing at `/l/:token` never
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

  const userId = createId();
  const locale = negotiateLocale(preferredFromAcceptLanguage(headers.get("accept-language")));
  const passwordHash = await hashPassword(password);
  const next = safeNextPath(input.next);
  // AD-15-11: a registration that came through a list link `/l/:token` never
  // creates a friendship, even if a body also carries an invite token — only the
  // `/i/` path does. `safeNextPath` has already rewritten `/l/x` to `/wishlist/x`.
  const inviteToken = next.startsWith("/wishlist/") ? undefined : input.inviteToken;
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
          await acceptInviteLinkInTransaction({ viewerId: userId, owner }, invite);
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
    data: { user, next },
  };
  if (!session.ok) {
    return {
      result: { ok: false, code: "UNAUTHENTICATED", message: "Sign-in after registration failed" },
    };
  }
  return { result, session };
}

function conflict(emailTaken: boolean, nickTaken: boolean): ActionResult<AuthPayload> {
  if (emailTaken) return validation("email", "EMAIL_TAKEN");
  return nickTaken ? validation("nick", "NICK_TAKEN") : validation();
}
