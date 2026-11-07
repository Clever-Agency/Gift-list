import "server-only";

import { prisma } from "@/db/client";
import { Prisma } from "@/db/generated/client";
import type {
  FriendshipPair,
  FriendshipStore,
  FriendshipTransaction,
  InviteCooldownRecord,
} from "@/domain/friendship";

type TransactionClient = Prisma.TransactionClient;

/**
 * Serialize every protocol write of one canonical pair (AD-10, Story 4.1.1 R1).
 *
 * `pg_advisory_xact_lock` is transaction-scoped: PostgreSQL releases it on
 * commit or rollback, so no cleanup path can leak it. The key is derived from
 * the ordered pair (`userLowId:userHighId`), so A→B and B→A wait on the same
 * lock and the second transaction reads the first committed invite. A hash
 * collision can only serialize two unrelated pairs, never skip a lock.
 *
 * This is plain PostgreSQL (AD-16), not a platform service, and it needs no
 * extra table or row that would outlive the transaction. Any later writer of
 * the same pair — accept in Story 4.2, block in Story 4.5 — must take the same
 * lock before it reads or writes the pair.
 */
async function lockPair(tx: TransactionClient, pair: FriendshipPair): Promise<void> {
  const pairKey = `${pair.userLowId}:${pair.userHighId}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${pairKey}, 0))`;
}

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

async function deleteInvite(
  tx: TransactionClient,
  fromUserId: string,
  toUserId: string,
): Promise<void> {
  await tx.friendshipInvite.deleteMany({ where: { fromUserId, toUserId } });
}

async function findInviteCooldown(
  tx: TransactionClient,
  pair: FriendshipPair,
): Promise<InviteCooldownRecord | null> {
  const row = await tx.inviteCooldown.findUnique({
    where: { userLowId_userHighId: pair },
    select: { until: true, rejectedFromUserId: true },
  });
  return row;
}

async function createInviteCooldown(
  tx: TransactionClient,
  pair: FriendshipPair,
  rejectedFromUserId: string,
  until: Date,
): Promise<void> {
  await tx.inviteCooldown.upsert({
    where: { userLowId_userHighId: pair },
    create: {
      userLowId: pair.userLowId,
      userHighId: pair.userHighId,
      rejectedFromUserId,
      until,
    },
    update: { rejectedFromUserId, until },
  });
}

async function deleteInviteCooldown(
  tx: TransactionClient,
  pair: FriendshipPair,
): Promise<void> {
  await tx.inviteCooldown.deleteMany({
    where: { userLowId: pair.userLowId, userHighId: pair.userHighId },
  });
}

function transactionAdapter(tx: TransactionClient): FriendshipTransaction {
  return {
    lockPair(pair) {
      return lockPair(tx, pair);
    },
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
    deleteInvite(fromUserId, toUserId) {
      return deleteInvite(tx, fromUserId, toUserId);
    },
    findInviteCooldown(pair) {
      return findInviteCooldown(tx, pair);
    },
    createInviteCooldown(pair, rejectedFromUserId, until) {
      return createInviteCooldown(tx, pair, rejectedFromUserId, until);
    },
    deleteInviteCooldown(pair) {
      return deleteInviteCooldown(tx, pair);
    },
  };
}

/**
 * Prisma adapter for the friendship protocol (AD-10, Story 4.1.1). It is the
 * only place that knows about `$transaction`: the domain rules run against the
 * `FriendshipTransaction` port, so every check and write of one send shares the
 * same transaction and a failure writes nothing.
 *
 * The isolation level is pinned to `READ COMMITTED` (the PostgreSQL default)
 * because the pair lock depends on it: after waiting for the lock, the next
 * statement must see the invite the other transaction just committed. A
 * database-level default of `REPEATABLE READ` would keep the old snapshot and
 * let the race back in.
 */
export const friendshipStore: FriendshipStore = {
  transaction(work) {
    return prisma.$transaction(
      async function runInTransaction(tx) {
        return work(transactionAdapter(tx));
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  },
};
