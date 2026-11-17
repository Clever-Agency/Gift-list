import "server-only";

import { prisma } from "@/db/client";
import type { CircleCandidate, CircleReader } from "@/domain/circle";
import { readProfileRelations } from "@/lib/relationships";

/** Only what a circle row shows; email, wishes and the search flag never load. */
type PersonRow = {
  readonly id: string;
  readonly name: string;
  readonly nick: string;
  readonly nameNormalized: string;
};

const personSelect = {
  id: true,
  name: true,
  nick: true,
  nameNormalized: true,
} as const;

/**
 * Every person the viewer has a `Block` with, in either direction (AD-10 step 4).
 * The edge is read once per list instead of as a `NOT EXISTS` per row, because
 * the domain — not SQL — owns the rule of dropping a blocked person from a
 * circle list, exactly like `hasBlockBetween` owns it for the write protocol.
 */
async function blockedUserIds(viewerId: string): Promise<Set<string>> {
  const rows = await prisma.block.findMany({
    where: {
      OR: [{ blockerId: viewerId }, { blockedId: viewerId }],
    },
    select: { blockerId: true, blockedId: true },
  });

  const ids = new Set<string>();
  for (const row of rows) {
    ids.add(row.blockerId === viewerId ? row.blockedId : row.blockerId);
  }
  return ids;
}

/**
 * Adds the facts of Story 4.3.2 to a list of people in a fixed number of
 * queries: one batch call of `readProfileRelations` (relationship, pending and
 * the viewer's own subscription), one read of the reverse subscriptions and one
 * read of the viewer's blocks. The number of queries never grows with the number
 * of rows, and an empty list asks nothing.
 */
async function withFacts(
  viewerId: string,
  people: readonly PersonRow[],
): Promise<CircleCandidate[]> {
  if (people.length === 0) return [];

  const ids = people.map(function idOf(person) {
    return person.id;
  });
  const [relations, follows, blocked] = await Promise.all([
    readProfileRelations(viewerId, ids),
    prisma.subscription.findMany({
      where: { targetId: viewerId, subscriberId: { in: ids } },
      select: { subscriberId: true },
    }),
    blockedUserIds(viewerId),
  ]);
  const followsViewer = new Set(
    follows.map(function subscriberOf(row) {
      return row.subscriberId;
    }),
  );

  return people.map(function toCandidate(person) {
    const facts = relations.get(person.id);
    return {
      id: person.id,
      displayName: person.name,
      nick: person.nick,
      nameNormalized: person.nameNormalized,
      relationship: facts?.relationship ?? "NONE",
      subscribed: facts?.subscribed ?? false,
      followsViewer: followsViewer.has(person.id),
      blocked: blocked.has(person.id),
    };
  });
}

/**
 * Prisma adapter of the circle reads (Story 4.3, AD-10, AD-13, AD-19).
 *
 * Every list is answered from the stored edges in one flat read and handed to
 * the domain as candidates; search, block filtering, ordering and cursor paging
 * stay in `domain/circle.ts`, where the tests can see them. A circle is the
 * viewer's own graph — tens to a few hundred people — so the page is cut from
 * the whole set after the search, which is exactly the AD-13 rule «search the
 * whole list, not the loaded page». If a circle ever outgrows that, the same
 * port can take `q`/`cursor` into SQL without touching the rules above it.
 *
 * The viewer's own id never reaches `withFacts`: an edge with oneself is
 * forbidden by the schema CHECKs (`Friendship`, `Subscription`).
 *
 * `relationship` and `subscribed` are the profile facts of Story 4.2.2, read
 * through `readProfileRelations`, so a circle row speaks the same vocabulary as
 * the profile buttons and a live rejection window forces `relationship: NONE`
 * in both places. `followsViewer` is the one reverse fact the profile reader does
 * not answer, so it is added by one more flat read.
 */
export const circleReader: CircleReader = {
  async readFriends(viewerId) {
    const edges = await prisma.friendship.findMany({
      where: { OR: [{ userLowId: viewerId }, { userHighId: viewerId }] },
      select: {
        userLow: { select: personSelect },
        userHigh: { select: personSelect },
      },
    });

    const people = edges.map(function counterpart(edge) {
      return edge.userLow.id === viewerId ? edge.userHigh : edge.userLow;
    });
    return withFacts(viewerId, people);
  },

  async readSubscriptions(viewerId) {
    const rows = await prisma.subscription.findMany({
      where: { subscriberId: viewerId },
      select: { target: { select: personSelect } },
    });
    return withFacts(
      viewerId,
      rows.map(function targetOf(row) {
        return row.target;
      }),
    );
  },

  async readSubscribers(viewerId) {
    const rows = await prisma.subscription.findMany({
      where: { targetId: viewerId },
      select: { subscriber: { select: personSelect } },
    });
    return withFacts(
      viewerId,
      rows.map(function subscriberOf(row) {
        return row.subscriber;
      }),
    );
  },

  async readIncomingInvites(viewerId) {
    const rows = await prisma.friendshipInvite.findMany({
      where: { toUserId: viewerId },
      select: { fromUser: { select: personSelect } },
    });
    return withFacts(
      viewerId,
      rows.map(function inviterOf(row) {
        return row.fromUser;
      }),
    );
  },

  async readOutgoingInvites(viewerId) {
    const rows = await prisma.friendshipInvite.findMany({
      where: { fromUserId: viewerId },
      select: { toUser: { select: personSelect } },
    });
    return withFacts(
      viewerId,
      rows.map(function recipientOf(row) {
        return row.toUser;
      }),
    );
  },
};
