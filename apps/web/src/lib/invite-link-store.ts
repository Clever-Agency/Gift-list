import "server-only";

import { createId } from "@paralleldrive/cuid2";
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
 * AD-21: one immutable invite token per user, created lazily when the profile or
 * the settings screen first asks for the link. Historical rows (users created
 * before Story 4.7.1) have no link, so the caller repairs instead of showing an
 * empty value.
 *
 * `InviteLink.userId` is the primary key, so a concurrent repair loses with
 * P2002 and keeps the winner's token; an existing token is never rewritten. A
 * P2002 on `token` (an impossible CUID2 collision) is rethrown when no link
 * exists: the caller must not report a link that was not created. The answer is
 * the live token, so the caller never reads the row a second time.
 */
export async function ensureInviteLink(userId: string): Promise<string> {
  try {
    const created = await prisma.inviteLink.create({
      data: { userId, token: createId() },
      select: { token: true },
    });
    return created.token;
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) {
      throw error;
    }

    const existing = await prisma.inviteLink.findUnique({
      where: { userId },
      select: { token: true },
    });
    if (existing === null) throw error;
    return existing.token;
  }
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
