import "server-only";

import { meSchema, type ActionResult, type Me } from "@gift-list/contracts";
import { prisma } from "@/db/client";
import { auth } from "@/lib/auth";
import { storedTimeZone } from "@/lib/time-zone";

const unauthenticated = {
  ok: false as const,
  code: "UNAUTHENTICATED" as const,
  message: "Authentication required",
};

/**
 * Use-case "current user": shared by the `getMe` Server Action and `GET /api/v1/me`.
 * Takes the request headers (cookie or `Authorization: Bearer`).
 * `timeZone` comes from the user row: `null` until Story 1.8 captures it.
 */
export async function getCurrentUser(headers: Headers): Promise<ActionResult<Me>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;
  const row = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, nick: true, timeZone: true },
  });
  if (!row) return unauthenticated;
  return {
    ok: true,
    data: meSchema.parse({
      id: row.id,
      email: row.email,
      name: row.name,
      nick: row.nick,
      timeZone: storedTimeZone(row.timeZone),
    }),
  };
}
