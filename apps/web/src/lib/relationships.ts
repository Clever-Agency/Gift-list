import "server-only";

import type { ProfileRelationship } from "@gift-list/contracts";
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

/**
 * The viewer's closed relation to the owner of a profile (AD-7, AD-10, Story
 * 4.1.2). This is the only read that answers a pending invite: `FRIENDS` comes
 * from the accepted edge, while `OUTGOING_PENDING` and `INCOMING_PENDING` never
 * open `FRIENDS` wishes. Visibility keeps deciding from its own `friend` and
 * `blocked` facts, so a pending invite cannot widen a list read.
 *
 * A friendship always wins over a pending invite; the protocol 4.1.1 R1 leaves
 * at most one pending direction per pair. The owner and an anonymous viewer have
 * no relation and cost no query. A block is deliberately not part of this
 * answer: `readWishlist` turns it into the same closed `not_found` as an unknown
 * nick, so a blocked profile never exposes even the fact that a relation exists.
 */
export async function readProfileRelationship(
  viewerId: string | null,
  ownerId: string,
): Promise<ProfileRelationship> {
  if (viewerId === null || viewerId === ownerId) return "NONE";

  const pair = orderFriendPair(viewerId, ownerId);
  const [friendship, outgoing, incoming] = await Promise.all([
    prisma.friendship.findUnique({
      where: { userLowId_userHighId: pair },
      select: { id: true },
    }),
    prisma.friendshipInvite.findUnique({
      where: { fromUserId_toUserId: { fromUserId: viewerId, toUserId: ownerId } },
      select: { id: true },
    }),
    prisma.friendshipInvite.findUnique({
      where: { fromUserId_toUserId: { fromUserId: ownerId, toUserId: viewerId } },
      select: { id: true },
    }),
  ]);

  if (friendship !== null) return "FRIENDS";
  if (outgoing !== null) return "OUTGOING_PENDING";
  if (incoming !== null) return "INCOMING_PENDING";
  return "NONE";
}
