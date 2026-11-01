import "server-only";

import { createId } from "@paralleldrive/cuid2";
import { hashPassword } from "better-auth/crypto";
import {
  negotiateLocale,
  preferredFromAcceptLanguage,
  rateLimitedError,
  safeNextPath,
  type ActionResult,
  type Me,
  type RegisterBody,
} from "@gift-list/contracts";
import { prisma } from "@/db/client";
import { Prisma } from "@/db/generated/client";
import { auth } from "@/lib/auth";
import { REGISTER_LIMIT, clientIp, consumeRateLimit } from "@/lib/rate-limit";

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
 * Creates the user, the credential account and exactly one list in one nested write,
 * then opens a Better Auth session. `accountId` matches `user.id` so `signInEmail` finds it.
 */
export async function registerUser(input: RegisterBody, headers: Headers): Promise<AuthOutcome> {
  const decision = await consumeRateLimit(`register:${clientIp(headers)}`, REGISTER_LIMIT);
  if (!decision.allowed) {
    return {
      result: rateLimitedError("Too many registration attempts", decision.retryAfterSeconds),
    };
  }

  const { email, password, displayName, nick } = input;
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { nickNormalized: nick }] },
    select: { email: true, nickNormalized: true },
  });
  if (existing) {
    return { result: conflict(existing.email === email, existing.nickNormalized === nick) };
  }

  const userId = createId();
  const locale = negotiateLocale(preferredFromAcceptLanguage(headers.get("accept-language")));
  try {
    await prisma.user.create({
      data: {
        id: userId,
        name: displayName,
        email,
        nick,
        nickNormalized: nick,
        locale,
        accounts: {
          create: {
            accountId: userId,
            providerId: "credential",
            password: await hashPassword(password),
          },
        },
        lists: {
          create: { publicToken: createId() },
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const taken = await prisma.user.findFirst({
        where: { OR: [{ email }, { nickNormalized: nick }] },
        select: { email: true, nickNormalized: true },
      });
      return { result: conflict(taken?.email === email, taken?.nickNormalized === nick) };
    }
    throw error;
  }

  const session = await auth.api.signInEmail({
    body: { email, password },
    headers,
    asResponse: true,
  });
  const user: Me = { id: userId, email, name: displayName, nick, timeZone: null };
  const result: ActionResult<AuthPayload> = {
    ok: true,
    data: { user, next: safeNextPath(input.next) },
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
