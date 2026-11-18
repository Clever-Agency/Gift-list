import "server-only";

import { prisma } from "@/db/client";
import { Prisma } from "@/db/generated/client";
import type {
  InviteLinkOwner,
  InviteLinkStore,
  InviteLinkTransaction,
} from "@/domain/invite-link";
import type { FriendshipPair } from "@/domain/friendship";
import { transactionAdapter } from "@/lib/friendship-store";

type TransactionClient = Prisma.TransactionClient;

/**
 * AD-21: the session user's stored invite token. Registration and the deploy
 * backfill are the only writers; this path never creates or updates a row. A
 * missing row after backfill is a broken invariant and surfaces as a Prisma
 * not-found error to the route (the client shows one error toast).
 */
export async function readInviteLinkToken(userId: string): Promise<string> {
  const row = await prisma.inviteLink.findUniqueOrThrow({
    where: { userId },
    select: { token: true },
  });
  return row.token;
}

/** The token owner as the link shows it: id, display name and nick only. */
async function findOwnerByToken(
  client: TransactionClient,
  token: string,
): Promise<InviteLinkOwner | null> {
  const row = await client.inviteLink.findUnique({
    where: { token },
    select: { user: { select: { id: true, name: true, nick: true } } },
  });
  if (row === null) return null;
  return { id: row.user.id, displayName: row.user.name, nick: row.user.nick };
}

/**
 * A `Block` row between the two users in either direction (AD-10 step 4). The
 * subscription adapter repeats the same read on purpose: a protocol owns its
 * gates instead of importing another protocol's transaction.
 */
async function hasBlockBetween(
  client: TransactionClient,
  firstUserId: string,
  secondUserId: string,
): Promise<boolean> {
  const row = await client.block.findFirst({
    where: {
      OR: [
        { blockerId: firstUserId, blockedId: secondUserId },
        { blockerId: secondUserId, blockedId: firstUserId },
      ],
    },
    select: { id: true },
  });
  return row !== null;
}

async function findFriendship(
  client: TransactionClient,
  pair: FriendshipPair,
): Promise<boolean> {
  const row = await client.friendship.findUnique({
    where: { userLowId_userHighId: pair },
    select: { id: true },
  });
  return row !== null;
}

/**
 * The invite-link port over a transaction the caller already opened. The pair
 * lock and every friendship write are the shared friendship adapter's calls, so
 * a link cannot invent a second way to create the edge; only the token lookup is
 * this protocol's own read. Registration uses it to keep User, List, InviteLink
 * and Friendship in one transaction (AD-21).
 */
export function inviteLinkTransaction(tx: TransactionClient): InviteLinkTransaction {
  const friendship = transactionAdapter(tx);
  return {
    findOwnerByToken(token) {
      return findOwnerByToken(tx, token);
    },
    lockPair(pair) {
      return friendship.lockPair(pair);
    },
    hasBlockBetween(firstUserId, secondUserId) {
      return friendship.hasBlockBetween(firstUserId, secondUserId);
    },
    findFriendship(pair) {
      return friendship.findFriendship(pair);
    },
    createFriendship(pair) {
      return friendship.createFriendship(pair);
    },
    deleteInvitesBetween(firstUserId, secondUserId) {
      return friendship.deleteInvitesBetween(firstUserId, secondUserId);
    },
  };
}

/**
 * Prisma adapter for the invite link (AD-21, Story 4.7.1). The same object
 * answers the read-only preview and opens the accept transaction: the preview
 * has no write method at all, so a page load or a messenger prefetch cannot
 * create a relationship.
 *
 * The isolation level is pinned to `READ COMMITTED` for the same reason as in
 * `friendshipStore`: after waiting for the pair lock the next statement must see
 * the edge another transaction just committed.
 */
export const inviteLinkStore: InviteLinkStore = {
  findOwnerByToken(token) {
    return findOwnerByToken(prisma, token);
  },
  hasBlockBetween(firstUserId, secondUserId) {
    return hasBlockBetween(prisma, firstUserId, secondUserId);
  },
  findFriendship(pair) {
    return findFriendship(prisma, pair);
  },
  transaction(work) {
    return prisma.$transaction(
      async function runInTransaction(tx) {
        return work(inviteLinkTransaction(tx));
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  },
};
