import "server-only";

import { meSchema, type ActionResult, type Me, type NickUpdateBody } from "@gift-list/contracts";
import { prisma } from "@/db/client";
import { Prisma } from "@/db/generated/client";
import { normalizeNick } from "@/domain/nick";
import { auth } from "@/lib/auth";
import { storedTimeZone } from "@/lib/time-zone";

const unauthenticated = {
  ok: false as const,
  code: "UNAUTHENTICATED" as const,
  message: "Authentication required",
};

/** AD-13: uniqueness is case-insensitive, so the error matches registration. */
const nickTaken = {
  ok: false as const,
  code: "VALIDATION" as const,
  message: "Nick is taken",
  field: "nick",
  reason: "NICK_TAKEN" as const,
};

/**
 * Story 3.1: the user changes their nick from Settings.
 * Only `User.nick` and `User.nickNormalized` change; `List.publicToken` is
 * immutable, so list links keep working (AD-6, A-26).
 */
export async function updateNick(input: NickUpdateBody, headers: Headers): Promise<ActionResult<Me>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;
  const row = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      nick: true,
      nickNormalized: true,
      timeZone: true,
    },
  });
  if (!row) return unauthenticated;

  const nick = input.nick;
  const nickNormalized = normalizeNick(nick);
  const current = meSchema.parse({
    id: row.id,
    email: row.email,
    name: row.name,
    nick: row.nick,
    timeZone: storedTimeZone(row.timeZone),
  });
  if (nickNormalized === row.nickNormalized) return { ok: true, data: current };

  const taken = await prisma.user.findFirst({
    where: { nickNormalized, id: { not: row.id } },
    select: { id: true },
  });
  if (taken) return nickTaken;

  try {
    await prisma.user.update({
      where: { id: row.id },
      data: { nick, nickNormalized },
    });
  } catch (error) {
    // Another user's write won the race after findFirst; the unique index decides.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return nickTaken;
    }
    throw error;
  }
  return { ok: true, data: { ...current, nick } };
}
