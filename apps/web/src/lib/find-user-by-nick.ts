import "server-only";

import { prisma } from "@/db/client";
import { isValidNick, normalizeNick } from "@/domain/nick";

/**
 * Resolves exactly one nick path segment to a user id.
 *
 * `normalizeNick` is the same gate `GET /api/v1/u/:nick` uses: case does not
 * matter, and a nick left behind by a rename does not resolve. A `null` answer
 * covers both an unknown and a malformed nick, so callers answer one closed
 * `NOT_FOUND` without naming anybody.
 */
export async function findUserIdByNick(nick: string): Promise<string | null> {
  const nickNormalized = normalizeNick(nick);
  if (!isValidNick(nickNormalized)) return null;

  const user = await prisma.user.findUnique({
    where: { nickNormalized },
    select: { id: true },
  });
  return user?.id ?? null;
}
