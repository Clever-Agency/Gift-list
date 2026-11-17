import "server-only";

import {
  meSchema,
  type ActionResult,
  type HideFromSearchUpdateBody,
  type Me,
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
 * Story 3.5 (FR-8, AD-13, AD-27): the settings switch keeps the person out of
 * the text search. Only `User.hideFromSearch` changes, and the answer is the
 * full `Me`, so the client puts the server value into `AuthContext` instead of
 * guessing it. `/u/:nick` and `/l/:token` do not read this flag (AD-7), so a
 * hidden person stays reachable by a direct profile or list link.
 */
export async function updateHideFromSearch(
  input: HideFromSearchUpdateBody,
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
  if (row.hideFromSearch === input.hideFromSearch) return { ok: true, data: current };

  await prisma.user.update({
    where: { id: row.id },
    data: { hideFromSearch: input.hideFromSearch },
  });
  return { ok: true, data: { ...current, hideFromSearch: input.hideFromSearch } };
}
