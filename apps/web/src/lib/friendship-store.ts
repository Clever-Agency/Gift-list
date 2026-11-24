import "server-only";

import { prisma } from "@/db/client";
import { enqueueFriendNotification } from "@/lib/notification-store";
import { Prisma } from "@/db/generated/client";
import type { BlockedReader } from "@/domain/block";
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

/**
 * One direction only (Story 4.5): the block protocol reports whether the
 * viewer's own row already existed, and a reverse block must never be mistaken
 * for it.
 */
async function findBlock(
  tx: TransactionClient,
  blockerId: string,
  blockedId: string,
): Promise<boolean> {
  const row = await tx.block.findUnique({
    where: { blockerId_blockedId: { blockerId, blockedId } },
    select: { id: true },
  });
  return row !== null;
}

/**
 * The directed UNIQUE index is the last guard, exactly like
 * `createSubscription`: a repeated block leaves one row and no constraint
 * error. The domain picks `ALREADY_BLOCKED` from its own directed read; this
 * insert only keeps a race from turning into a `P2002`.
 */
async function insertBlock(
  tx: TransactionClient,
  blockerId: string,
  blockedId: string,
): Promise<void> {
  await tx.block.createMany({ data: [{ blockerId, blockedId }], skipDuplicates: true });
}

/** `deleteMany` keeps an unblock idempotent; the count tells which answer it is. */
async function deleteBlock(
  tx: TransactionClient,
  blockerId: string,
  blockedId: string,
): Promise<boolean> {
  const { count } = await tx.block.deleteMany({ where: { blockerId, blockedId } });
  return count > 0;
}

/** AD-19: a block deletes the subscription rows in both directions of the pair. */
async function deleteSubscriptionsBetween(
  tx: TransactionClient,
  firstUserId: string,
  secondUserId: string,
): Promise<void> {
  await tx.subscription.deleteMany({
    where: {
      OR: [
        { subscriberId: firstUserId, targetId: secondUserId },
        { subscriberId: secondUserId, targetId: firstUserId },
      ],
    },
  });
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
  const invite = await tx.friendshipInvite.create({ data: { fromUserId, toUserId } });
  await enqueueFriendNotification(tx, "FRIEND_INVITE", invite.id, fromUserId, toUserId, invite.createdAt);
}

async function createFriendship(
  tx: TransactionClient,
  pair: FriendshipPair,
): Promise<void> {
  await tx.friendship.create({
    data: { userLowId: pair.userLowId, userHighId: pair.userHighId },
  });
}

/**
 * Unfriend (Story 4.4, AD-10 step 4). `deleteMany` keeps the removal idempotent:
 * a pair without an edge is a no-op instead of a `P2025`, which is what the
 * domain's `ALREADY_REMOVED` answer relies on. Only the edge is removed here;
 * subscriptions and any block row are left to their own stories.
 */
async function deleteFriendship(
  tx: TransactionClient,
  pair: FriendshipPair,
): Promise<void> {
  await tx.friendship.deleteMany({
    where: { userLowId: pair.userLowId, userHighId: pair.userHighId },
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

/**
 * The `FriendshipTransaction` port over a transaction the caller already opened.
 * Exported for registration (AD-21, Story 4.7.1): the account, its list, the
 * invite link and the friendship must share one `$transaction`, so the caller
 * cannot use `friendshipStore`, which opens its own.
 */
export function transactionAdapter(tx: TransactionClient): FriendshipTransaction {
  return {
    lockPair(pair) {
      return lockPair(tx, pair);
    },
    hasBlockBetween(firstUserId, secondUserId) {
      return hasBlockBetween(tx, firstUserId, secondUserId);
    },
    findBlock(blockerId, blockedId) {
      return findBlock(tx, blockerId, blockedId);
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
    deleteFriendship(pair) {
      return deleteFriendship(tx, pair);
    },
    deleteInvitesBetween(firstUserId, secondUserId) {
      return deleteInvitesBetween(tx, firstUserId, secondUserId);
    },
    insertBlock(blockerId, blockedId) {
      return insertBlock(tx, blockerId, blockedId);
    },
    deleteBlock(blockerId, blockedId) {
      return deleteBlock(tx, blockerId, blockedId);
    },
    deleteSubscriptionsBetween(firstUserId, secondUserId) {
      return deleteSubscriptionsBetween(tx, firstUserId, secondUserId);
    },
    async notifyInviteResponse(kind, inviterId, inviteeId) {
      const invite = await tx.friendshipInvite.findUnique({
        where: { fromUserId_toUserId: { fromUserId: inviterId, toUserId: inviteeId } },
        select: { id: true },
      });
      if (invite) await enqueueFriendNotification(tx, kind, invite.id, inviteeId, inviterId);
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

/**
 * «Заблокированные» of Story 4.5.2: only the rows the viewer made
 * (`blockerId = viewerId`), so a person who blocked the viewer is never revealed
 * by this list. Newest first, then the descending CUID2 id, which is exactly the
 * order `readBlockedPage` cuts its cursor page in. A row carries the three
 * fields of the person plus the block time the cursor needs; avatar, wishes and
 * email never load.
 */
export const blockedPeopleReader: BlockedReader = {
  async readBlockedPeople(viewerId) {
    const rows = await prisma.block.findMany({
      where: { blockerId: viewerId },
      select: {
        createdAt: true,
        blocked: { select: { id: true, name: true, nick: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });

    return rows.map(function toBlockedPerson(row) {
      return {
        id: row.blocked.id,
        displayName: row.blocked.name,
        nick: row.blocked.nick,
        blockedAt: row.createdAt,
      };
    });
  },
};
