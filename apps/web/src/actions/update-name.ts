import "server-only";

import {
  meSchema,
  normalizeForSearch,
  type ActionResult,
  type Me,
  type NameUpdateBody,
} from "@gift-list/contracts";
import { prisma } from "@/db/client";
import { auth } from "@/lib/auth";
import { storedTimeZone } from "@/lib/time-zone";

const unauthenticated = {
  ok: false as const,
  code: "UNAUTHENTICATED" as const,
  message: "Authentication required",
};

/**
 * CLE-129 (D-59, AD-27): the display name is edited in `/profile`, not in
 * `/settings`. Only `User.name` and its search key `User.nameNormalized` change;
 * Better Auth's raw `/update-user` stays disabled, because it would write the
 * name past the normalised column and the circle search would stop finding the
 * person (AD-27). The answer is the full `Me`, so the client puts the server
 * value into `AuthContext` without a reload.
 *
 * A trimmed name equal to the stored one is not a change: the action answers
 * the current user and writes nothing. The contract already trims and caps the
 * value, but the action trims again for direct callers, the same way
 * `updateNick` normalises its own input.
 */
export async function updateName(
  input: NameUpdateBody,
  headers: Headers,
): Promise<ActionResult<Me>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;
  const row = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      nick: true,
      timeZone: true,
      hideFromSearch: true,
    },
  });
  if (!row) return unauthenticated;

  const current = meSchema.parse({
    id: row.id,
    email: row.email,
    name: row.name,
    nick: row.nick,
    timeZone: storedTimeZone(row.timeZone),
    hideFromSearch: row.hideFromSearch,
  });

  const name = input.name.trim();
  if (name === row.name) return { ok: true, data: current };

  await prisma.user.update({
    where: { id: row.id },
    data: { name, nameNormalized: normalizeForSearch(name) },
  });
  return { ok: true, data: { ...current, name } };
}
