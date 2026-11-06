import "server-only";

import { prisma } from "@/db/client";
import type { Prisma } from "@/db/generated/client";
import type {
  FriendshipPair,
  FriendshipStore,
  FriendshipTransaction,
} from "@/domain/friendship";

type TransactionClient = Prisma.TransactionClient;

async function hasBlockBetween(
  tx: TransactionClient,
  firstUserId: string,
  secondUserId: string,
): Promise<boolean> {
  const row = await tx.block.findFirst({
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
  tx: TransactionClient,
  pair: FriendshipPair,
): Promise<boolean> {
  const row = await tx.friendship.findUnique({
    where: { userLowId_userHighId: pair },
    select: { id: true },
  });
  return row !== null;
}

async function findPendingInvite(
  tx: TransactionClient,
  fromUserId: string,
  toUserId: string,
): Promise<boolean> {
  const row = await tx.friendshipInvite.findUnique({
    where: { fromUserId_toUserId: { fromUserId, toUserId } },
    select: { id: true },
  });
  return row !== null;
}

async function createInvite(
  tx: TransactionClient,
  fromUserId: string,
  toUserId: string,
): Promise<void> {
  await tx.friendshipInvite.create({ data: { fromUserId, toUserId } });
}

async function createFriendship(
  tx: TransactionClient,
  pair: FriendshipPair,
): Promise<void> {
  await tx.friendship.create({
    data: { userLowId: pair.userLowId, userHighId: pair.userHighId },
  });
}

async function deleteInvitesBetween(
  tx: TransactionClient,
  firstUserId: string,
  secondUserId: string,
): Promise<void> {
  await tx.friendshipInvite.deleteMany({
    where: {
      OR: [
        { fromUserId: firstUserId, toUserId: secondUserId },
        { fromUserId: secondUserId, toUserId: firstUserId },
      ],
    },
  });
}

function transactionAdapter(tx: TransactionClient): FriendshipTransaction {
  return {
    hasBlockBetween(firstUserId, secondUserId) {
      return hasBlockBetween(tx, firstUserId, secondUserId);
    },
    findFriendship(pair) {
      return findFriendship(tx, pair);
    },
    findPendingInvite(fromUserId, toUserId) {
      return findPendingInvite(tx, fromUserId, toUserId);
    },
    createInvite(fromUserId, toUserId) {
      return createInvite(tx, fromUserId, toUserId);
    },
    createFriendship(pair) {
      return createFriendship(tx, pair);
    },
    deleteInvitesBetween(firstUserId, secondUserId) {
      return deleteInvitesBetween(tx, firstUserId, secondUserId);
    },
  };
}

/**
 * Prisma adapter for the friendship protocol (AD-10, Story 4.1.1). It is the
 * only place that knows about `$transaction`: the domain rules run against the
 * `FriendshipTransaction` port, so every check and write of one send shares the
 * same transaction and a failure writes nothing.
 */
export const friendshipStore: FriendshipStore = {
  transaction(work) {
    return prisma.$transaction(async function runInTransaction(tx) {
      return work(transactionAdapter(tx));
    });
  },
};
