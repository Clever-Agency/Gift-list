import "server-only";

import { prisma } from "@/db/client";
import { Prisma, type PrismaClient } from "@/db/generated/client";
import type { GiftStatusEvent } from "@/domain/gift-status";
import { giftStatusTransaction, recordGiftEvent } from "@/lib/gift-status-store";
import { enqueueGiftNotification, notificationGiftSnapshot } from "@/lib/notification-store";

/**
 * Story 6.3 (FR-51, AD-20, D-33, D-49): the answer of the one account-deletion
 * command. `deleted` — the rows were removed; `already-deleted` — the account is
 * gone (or never existed), so a repeated call has nothing to delete and is a
 * success for the caller; `busy` — the reservations of the account kept moving
 * under every attempt, the whole transaction rolled back and nothing was
 * removed, so the caller may simply retry.
 */
export type DeleteAccountOutcome = "deleted" | "already-deleted" | "busy";

/** The clock and the database are injectable, as everywhere else in the use-cases. */
export type DeleteAccountOptions = {
  readonly now?: Date;
  readonly db?: Pick<PrismaClient, "$transaction">;
};

/**
 * D-49 (CLE-124) follows the delete use-case: a reservation that lands under
 * the release is not an error for anybody. Three re-reads are enough for the
 * same reason as there — each pass releases whatever is actually held.
 */
const MAX_RELEASE_ATTEMPTS = 3;

/**
 * R1: a value returned from an interactive transaction commits it, so an
 * attempt that lost every CAS must not answer `busy` from inside — the release
 * it may have made would stay behind. Throwing rolls the whole transaction
 * back; the command turns the signal into `busy` outside, where nothing was
 * written.
 */
class DeleteAccountBusy extends Error {
  constructor() {
    super("deleteAccount: the reservations kept moving");
    this.name = "DeleteAccountBusy";
  }
}

/** A reservation that landed between the last check and `User.deleteMany` (AD-20). */
function isForeignKeyViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003";
}

/**
 * AD-20 step 1 (D-49): every reservation of the account goes off through
 * `GiftStatusService`, which is the only writer of the reservation columns.
 *
 * `RESERVED` rows are cleared exactly like the holder's own release, and a
 * `CLOSED` row — the closure keeps the past holder for audit — loses only its
 * link to the account that is about to disappear (`Gift.reservedById` is
 * `Restrict`). The owner is never told (AD-15/D-49): the wish simply reads
 * `OPEN` again, and its owner never learns a reservation existed.
 *
 * A lost CAS re-reads what is actually there: a concurrent release or the
 * cron may have moved the row already. A row that keeps moving for every
 * attempt throws {@link DeleteAccountBusy}, and the transaction rolls back.
 */
async function releaseReservationsOfAccount(
  tx: Prisma.TransactionClient,
  userId: string,
  at: Date,
  events: GiftStatusEvent[],
): Promise<void> {
  const service = giftStatusTransaction(tx, function collect(event) {
    events.push(event);
  });

  for (let attempt = 1; attempt <= MAX_RELEASE_ATTEMPTS; attempt += 1) {
    const rows = await tx.gift.findMany({
      where: { reservedById: userId },
      select: { id: true },
      orderBy: { id: "asc" },
    });
    if (rows.length === 0) return;

    for (const row of rows) {
      await service.releaseReservationByAccountDeletion(row.id, userId, at);
    }
  }

  // The last read decides: only an id can be here, so no card leaves the gate.
  const remaining = await tx.gift.findMany({
    where: { reservedById: userId },
    select: { id: true },
    take: 1,
  });
  if (remaining.length > 0) throw new DeleteAccountBusy();
}

/**
 * AD-20 step 2: the holders of reservations on the wishes of the account get
 * one "the gift is gone" notice each, the same `GIFT_DELETED` row the owner's
 * own delete writes (Story 5.4). The title is the snapshot taken when the
 * reservation was made (`titleSnapshotOnReserve`), so the notice names the wish
 * the holder actually saw. The snapshots are read before the rows go away.
 */
async function notifyHoldersOfOwnWishes(
  tx: Prisma.TransactionClient,
  userId: string,
  at: Date,
): Promise<void> {
  const rows = await tx.gift.findMany({
    where: { list: { ownerId: userId }, status: "RESERVED", reservedById: { not: null } },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  for (const row of rows) {
    const snapshot = await notificationGiftSnapshot(tx, row.id);
    if (snapshot === null) continue;
    await enqueueGiftNotification(tx, snapshot, {
      kind: "GIFT_DELETED", role: "holder", email: true, at,
    });
  }
}

/**
 * Story 6.3 (FR-51, AD-20, D-33): the one account-deletion command — the web
 * and the app both call it, and a direct `deleteUser` of Better Auth or a raw
 * SQL `onDelete` chain is forbidden. Everything happens inside one transaction:
 * a failure leaves the account and its data as they were.
 *
 * The order is the one AD-20 fixes: reservations of the account are released
 * through `GiftStatusService`; the holders of reservations on its wishes are
 * told; then every row that belongs to the account is deleted explicitly —
 * tags, wishes, the list, the invite link, friendships, invites, blocks,
 * subscriptions, cooldowns, notifications it received, reminder logs, sessions,
 * Better Auth accounts, its verification rows and finally the `User` row
 * itself. Phone
 * columns are not in the schema yet; when they arrive they belong here too.
 *
 * The rows are removed by id, so `onDelete` is a safety net, not the mechanism.
 * Sessions of both channels are the same `Session` rows, so deleting them
 * signs out the cookie and the bearer clients at once. After the commit a
 * public `/l/:token` of the deleted list reads no list and answers `NOT_FOUND`.
 *
 * A notification of somebody else that names the account as its actor stays:
 * `Notification.actorId` has no foreign key, and the feed renders such a row
 * from its stored snapshot. A second call for an account that is gone answers
 * `already-deleted` and writes nothing.
 */
export async function deleteAccount(
  userId: string,
  options: DeleteAccountOptions = {},
): Promise<DeleteAccountOutcome> {
  const now = options.now ?? new Date();
  const db = options.db ?? prisma;
  const events: GiftStatusEvent[] = [];

  let outcome: DeleteAccountOutcome;
  try {
    outcome = await db.$transaction(async function deleteAccountRows(
      tx,
    ): Promise<DeleteAccountOutcome> {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true },
      });
      // Idempotent: a repeated call and an unknown id have nothing to delete.
      if (user === null) return "already-deleted";

      await releaseReservationsOfAccount(tx, userId, now, events);
      await notifyHoldersOfOwnWishes(tx, userId, now);

      // Everything that points at the user goes first; the `User` row is last.
      await tx.giftTag.deleteMany({ where: { gift: { list: { ownerId: userId } } } });
      await tx.gift.deleteMany({ where: { list: { ownerId: userId } } });
      await tx.list.deleteMany({ where: { ownerId: userId } });
      await tx.inviteLink.deleteMany({ where: { userId } });
      await tx.friendship.deleteMany({
        where: { OR: [{ userLowId: userId }, { userHighId: userId }] },
      });
      await tx.friendshipInvite.deleteMany({
        where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
      });
      await tx.block.deleteMany({
        where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      });
      await tx.subscription.deleteMany({
        where: { OR: [{ subscriberId: userId }, { targetId: userId }] },
      });
      await tx.inviteCooldown.deleteMany({
        where: {
          OR: [
            { userLowId: userId },
            { userHighId: userId },
            { rejectedFromUserId: userId },
          ],
        },
      });
      await tx.notification.deleteMany({ where: { recipientId: userId } });
      // AD-23: the date reminders already sent to the account go with it; the
      // `ReminderLog` rows of other people stay, their `subjectId` has no key.
      await tx.reminderLog.deleteMany({ where: { recipientId: userId } });
      await tx.session.deleteMany({ where: { userId } });
      await tx.account.deleteMany({ where: { userId } });
      // Password-reset rows store the id as their value, the change-email
      // memory names the user in its identifier, and a legacy address
      // verification row is keyed by the address itself.
      await tx.verification.deleteMany({
        where: {
          OR: [
            { identifier: user.email },
            { value: user.email },
            { value: userId },
            { identifier: `change-email:${userId}` },
          ],
        },
      });
      await tx.user.deleteMany({ where: { id: userId } });
      return "deleted";
    });
  } catch (error) {
    // A reservation the last check did not see (`Restrict`) or an endless CAS
    // race: the transaction rolled back, so the caller retries the whole call.
    if (error instanceof DeleteAccountBusy || isForeignKeyViolation(error)) {
      return "busy";
    }
    throw error;
  }

  // NFR-6: the transitions are reported only after the commit that made them.
  if (outcome === "deleted") {
    for (const event of events) recordGiftEvent(event);
  }
  return outcome;
}
