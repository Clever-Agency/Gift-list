import "server-only";

import { prisma } from "@/db/client";
import { orderFriendPair } from "@/domain/friendship";
import type { RelationshipReader, ViewerRelations } from "@/domain/visibility";

/** Nobody is related to themselves; the owner branch never asks the port. */
const noRelations: Omit<ViewerRelations, "viaListToken"> = {
  blocked: false,
  friend: false,
  subscriber: false,
  contactMatch: false,
};

/**
 * Relation facts for the viewer/owner pair (AD-7, AD-10, Story 4.1.1).
 *
 * - `friend` — an accepted `Friendship` edge, stored once as the canonical
 *   `userLowId < userHighId` pair;
 * - `blocked` — a `Block` in either direction, so a block hides both profiles;
 * - `subscriber` and `contactMatch` stay `false`: neither table exists in R1 and
 *   this reader must not pretend otherwise (AD-19, AD-18).
 *
 * An anonymous viewer cannot have either edge, and the owner branch never asks
 * the port, so both answer without reading the database.
 */
async function relationsBetween(
  viewerId: string | null,
  ownerId: string,
): Promise<Omit<ViewerRelations, "viaListToken">> {
  if (viewerId === null || viewerId === ownerId) return noRelations;

  const pair = orderFriendPair(viewerId, ownerId);
  const [friendship, block] = await Promise.all([
    prisma.friendship.findUnique({
      where: { userLowId_userHighId: pair },
      select: { id: true },
    }),
    prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: viewerId, blockedId: ownerId },
          { blockerId: ownerId, blockedId: viewerId },
        ],
      },
      select: { id: true },
    }),
  ]);

  return {
    blocked: block !== null,
    friend: friendship !== null,
    subscriber: false,
    contactMatch: false,
  };
}

export const relationshipReader: RelationshipReader = { relationsBetween };
