import "server-only";

import type { ProfileInviteCooldown, ProfileRelationship } from "@gift-list/contracts";
import { prisma } from "@/db/client";
import {
  liveInviteCooldownHours,
  orderFriendPair,
  type FriendshipPair,
} from "@/domain/friendship";
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
 * - `subscriber` — a directed `Subscription` row `viewerId → ownerId` (AD-19).
 *   It opens only PUBLIC wishes and never becomes a friendship, so a
 *   subscriber is never reported as a friend;
 * - `contactMatch` stays `false`: the table arrives with the phone-book story
 *   and this reader must not pretend otherwise (AD-18).
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
  const [friendship, block, subscription] = await Promise.all([
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
    prisma.subscription.findUnique({
      where: { subscriberId_targetId: { subscriberId: viewerId, targetId: ownerId } },
      select: { id: true },
    }),
  ]);

  return {
    blocked: block !== null,
    friend: friendship !== null,
    subscriber: subscription !== null,
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

/**
 * The viewer's live rejection cooldown with the profile owner (Story 4.2.2,
 * AD-10 step 3, A-16). Only an `until > now` row counts; an expired row is not
 * removed by this read because the next successful send deletes it.
 *
 * The answer is profile-only: `/l/:token` and `/me` never ask for it. `rejected`
 * is true exactly for the sender of the rejected invite (`rejectedFromUserId`),
 * so A sees "отклонено" while B only learns the remaining hours. The owner and
 * an anonymous viewer have no pair and cost no query.
 */
export async function readProfileInviteCooldown(
  viewerId: string | null,
  ownerId: string,
): Promise<ProfileInviteCooldown | null> {
  if (viewerId === null || viewerId === ownerId) return null;

  const pair = orderFriendPair(viewerId, ownerId);
  const row = await prisma.inviteCooldown.findUnique({
    where: { userLowId_userHighId: pair },
    select: { until: true, rejectedFromUserId: true },
  });
  if (row === null) return null;

  const hours = liveInviteCooldownHours(row);
  if (hours === null) return null;

  return { hours, rejected: row.rejectedFromUserId === viewerId };
}

/**
 * The viewer's own directed subscription to the profile owner (Story 4.6,
 * FR-46, AD-19). The profile screen reads it only to pick «Подписаться» or
 * «Отписаться»; `/l/:token` and `/me` never ask. The owner and an anonymous
 * viewer have no edge and cost no query. A subscription is not a relationship
 * and never becomes a friendship: this reader says one fact, not a relation.
 */
export async function readProfileSubscription(
  viewerId: string | null,
  ownerId: string,
): Promise<boolean> {
  if (viewerId === null || viewerId === ownerId) return false;

  const row = await prisma.subscription.findUnique({
    where: { subscriberId_targetId: { subscriberId: viewerId, targetId: ownerId } },
    select: { id: true },
  });
  return row !== null;
}

/** What a «Добавить в друзья» button may learn about one person. */
export type ProfileRelationFacts = {
  relationship: ProfileRelationship;
  inviteCooldown?: ProfileInviteCooldown;
};

/**
 * One person row: the friend action's facts and the independent subscription
 * switch. A subscription is not a relation, so it travels next to
 * `relationship` instead of changing it (AD-19).
 */
export type PersonRelationFacts = ProfileRelationFacts & { subscribed: boolean };

/**
 * The pair of facts a «Добавить в друзья» button reads about one person
 * (Story 4.1.2, 4.2.2). While the rejection cooldown is live the relationship
 * is forced to `NONE`: a rejection leaves no edge and no pending invite, so
 * neither `FRIENDS` nor a pending direction may be shown next to the cooldown.
 * The field is absent when the window is closed or expired.
 */
export function profileRelationFacts(
  relationship: ProfileRelationship,
  inviteCooldown: ProfileInviteCooldown | null,
): ProfileRelationFacts {
  return inviteCooldown === null ? { relationship } : { relationship: "NONE", inviteCooldown };
}

/** The viewer's own row and an anonymous viewer: no edge and no subscription. */
function noPersonRelationFacts(): PersonRelationFacts {
  return { relationship: "NONE", subscribed: false };
}

/**
 * One key for a canonical pair. The ids are CUID2, so they never contain NUL and
 * the two halves of the key can never be confused.
 */
function pairKey(pair: FriendshipPair): string {
  return `${pair.userLowId}\u0000${pair.userHighId}`;
}

/**
 * The same facts for a whole page of people in a fixed number of queries (Story
 * 3.5, CLE-70 / F3). Search fills every card of one answer with this call: four
 * flat `IN` reads for the whole list instead of two pair reads per card, so a
 * 20-row answer costs exactly what a 1-row answer costs. Wishes are never read
 * and no profile is assembled (NFR-3).
 *
 * The returned map has an entry for every requested id. A relation is decided by
 * the same rules as the profile button: an accepted edge wins, then the viewer's
 * outgoing invite, then an incoming one; a live rejection cooldown forces
 * `relationship: NONE` through {@link profileRelationFacts}. A Block is not part
 * of this answer because search drops blocked rows in SQL (AD-7). The viewer's
 * own id and an anonymous viewer cost no query and answer `NONE` / `false`.
 */
export async function readProfileRelations(
  viewerId: string | null,
  ownerIds: readonly string[],
): Promise<Map<string, PersonRelationFacts>> {
  const facts = new Map<string, PersonRelationFacts>();
  const owners = [...new Set(ownerIds)];
  if (viewerId === null) {
    for (const ownerId of owners) facts.set(ownerId, noPersonRelationFacts());
    return facts;
  }

  const others = owners.filter((ownerId) => ownerId !== viewerId);
  if (owners.includes(viewerId)) facts.set(viewerId, noPersonRelationFacts());
  if (others.length === 0) return facts;

  // A pair row is mapped back to its owner through this table, so the answer is
  // assembled without one lookup per card.
  const ownerByPair = new Map<string, string>();
  const pairs = others.map(function pairForOwner(ownerId) {
    const pair = orderFriendPair(viewerId, ownerId);
    ownerByPair.set(pairKey(pair), ownerId);
    return pair;
  });

  const [friendships, invites, cooldowns, subscriptions] = await Promise.all([
    prisma.friendship.findMany({
      where: { OR: pairs },
      select: { userLowId: true, userHighId: true },
    }),
    // Both pending directions in one read: the viewer's own invite and an invite
    // addressed to the viewer.
    prisma.friendshipInvite.findMany({
      where: {
        OR: [
          { fromUserId: viewerId, toUserId: { in: others } },
          { fromUserId: { in: others }, toUserId: viewerId },
        ],
      },
      select: { fromUserId: true, toUserId: true },
    }),
    prisma.inviteCooldown.findMany({
      where: { OR: pairs },
      select: { userLowId: true, userHighId: true, until: true, rejectedFromUserId: true },
    }),
    prisma.subscription.findMany({
      where: { subscriberId: viewerId, targetId: { in: others } },
      select: { targetId: true },
    }),
  ]);

  const friends = new Set<string>();
  for (const row of friendships) {
    const ownerId = ownerByPair.get(pairKey(row));
    if (ownerId !== undefined) friends.add(ownerId);
  }
  const outgoing = new Set(
    invites
      .filter((row) => row.fromUserId === viewerId)
      .map((row) => row.toUserId),
  );
  const incoming = new Set(
    invites
      .filter((row) => row.toUserId === viewerId)
      .map((row) => row.fromUserId),
  );
  const cooldownByOwner = new Map<string, ProfileInviteCooldown>();
  for (const row of cooldowns) {
    const ownerId = ownerByPair.get(pairKey(row));
    if (ownerId === undefined) continue;
    const hours = liveInviteCooldownHours(row);
    if (hours === null) continue;
    cooldownByOwner.set(ownerId, { hours, rejected: row.rejectedFromUserId === viewerId });
  }
  const subscribed = new Set(subscriptions.map((row) => row.targetId));

  for (const ownerId of others) {
    const relationship: ProfileRelationship = friends.has(ownerId)
      ? "FRIENDS"
      : outgoing.has(ownerId)
        ? "OUTGOING_PENDING"
        : incoming.has(ownerId)
          ? "INCOMING_PENDING"
          : "NONE";
    facts.set(ownerId, {
      ...profileRelationFacts(relationship, cooldownByOwner.get(ownerId) ?? null),
      subscribed: subscribed.has(ownerId),
    });
  }

  return facts;
}
