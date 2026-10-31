"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createId } from "@paralleldrive/cuid2";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import type { ActionResult, ErrorReason } from "@gift-list/contracts";
import { prisma } from "@/db/client";
import { Prisma } from "@/db/generated/client";
import { LIST_TYPES, NICK_RULES_TEXT, isValidNick, normalizeNick } from "@/domain";
import { auth } from "@/lib/auth";
import { firstIssueField } from "@/lib/api-v1";
import { REGISTER_LIMIT, consumeRateLimit, getClientIp } from "@/lib/rate-limit";

export type RegisterState = Extract<ActionResult<never>, { ok: false }> | null;

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Введите корректный email")),
  password: z
    .string()
    .min(8, "Пароль — не короче 8 символов")
    .max(128, "Пароль — не длиннее 128 символов"),
  displayName: z
    .string()
    .trim()
    .min(1, "Укажите имя")
    .max(50, "Имя — не длиннее 50 символов"),
  nick: z
    .string()
    .transform(normalizeNick)
    .refine(isValidNick, NICK_RULES_TEXT),
});

function validation(field?: string, reason?: ErrorReason): RegisterState {
  return {
    ok: false,
    code: "VALIDATION",
    message: "Invalid input",
    ...(field ? { field } : {}),
    ...(reason ? { reason } : {}),
  };
}

/**
 * Registers a user. User, credential account and both lists are one nested
 * `create` (a single DB transaction), then the session is opened via Better Auth.
 */
export async function register(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName"),
    nick: formData.get("nick") ?? "",
  });
  if (!parsed.success) {
    return validation(firstIssueField(parsed.error));
  }
  const { email, password, displayName, nick } = parsed.data;

  // Counted after validation so typos don't burn attempts; duplicate probing does.
  const allowed = await consumeRateLimit(
    `register:${await getClientIp()}`,
    REGISTER_LIMIT,
  );
  if (!allowed) {
    return {
      ok: false,
      code: "RATE_LIMITED",
      message: "Too many registration attempts",
    };
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { nickNormalized: nick }] },
    select: { email: true, nickNormalized: true },
  });
  if (existing) return conflictErrors(existing.email === email, existing.nickNormalized === nick);

  const userId = createId();
  try {
    await prisma.user.create({
      data: {
        id: userId,
        name: displayName,
        email,
        nick,
        nickNormalized: nick,
        accounts: {
          create: {
            accountId: userId,
            providerId: "credential",
            password: await hashPassword(password),
          },
        },
        lists: {
          create: LIST_TYPES.map((type) => ({ type, publicToken: createId() })),
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // Lost a race with a concurrent registration: report which value is taken.
      const taken = await prisma.user.findFirst({
        where: { OR: [{ email }, { nickNormalized: nick }] },
        select: { email: true, nickNormalized: true },
      });
      return conflictErrors(taken?.email === email, taken?.nickNormalized === nick);
    }
    throw error;
  }

  await auth.api.signInEmail({
    body: { email, password },
    headers: await headers(),
  });
  redirect("/lists");
}

function conflictErrors(emailTaken: boolean, nickTaken: boolean): RegisterState {
  // Both taken: report the email only, so the response does not confirm a nick for that address.
  if (emailTaken) {
    return validation("email", "EMAIL_TAKEN");
  }
  return nickTaken ? validation("nick", "NICK_TAKEN") : validation();
}
