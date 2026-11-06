import "server-only";

import { createId } from "@paralleldrive/cuid2";
import { prisma } from "@/db/client";
import { Prisma } from "@/db/generated/client";

/**
 * AD-6: the single list and its immutable token are created with the account.
 * Historical rows can predate that rule, so the owner read repairs a missing row
 * instead of answering an empty wishlist without a share token.
 *
 * `List.ownerId` is UNIQUE, so a concurrent repair loses with P2002 and keeps
 * the winner's row; an existing token is never rewritten. A P2002 on
 * `publicToken` (an impossible CUID2 collision) is rethrown when no list exists:
 * the caller must not report a repaired list that was not created.
 */
export async function ensureOwnerList(ownerId: string): Promise<void> {
  try {
    await prisma.list.create({
      data: { ownerId, publicToken: createId() },
      select: { id: true },
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) {
      throw error;
    }

    const existing = await prisma.list.findUnique({
      where: { ownerId },
      select: { id: true },
    });
    if (existing === null) throw error;
  }
}
