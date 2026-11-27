import "server-only";

import { readWishlist } from "@/actions/wishlist-read";
import { prisma } from "@/db/client";
import type { PrismaClient } from "@/db/generated/client";
import {
  BIRTHDAY_FRIEND_REMINDER_DAYS,
  DATE_REMINDER_HOUR,
  birthdayDayInYear,
  dueBirthdayReminderYear,
  recipientLocalMoment,
} from "@/domain/birthday-reminder";
import { enqueueNotification } from "@/lib/notification-store";
import { isSchemaNotMigrated } from "@/lib/schema-not-migrated";

/**
 * Story 7.3 (FR-34, AD-23): the hourly cron of `api/cron/date-reminders` sends
 * one notice 14 days before a Friend's birthday. The candidate rules are the
 * pure date helpers of `domain/birthday-reminder`; this file is the Prisma
 * adapter that reads the rows and writes `ReminderLog` + `Notification` in one
 * transaction. The UNIQUE key of `ReminderLog` is the mechanism that keeps a
 * repeated run to one row, so the transaction writes the notice only when the
 * log row was actually inserted.
 *
 * A Friend's birthday leaves no trace for the owner of the wishes: the payload
 * carries the Friend's name, nick and a machine-readable date, the number of
 * open visible wishes and up to three titles. It never names a holder, and only
 * `OPEN`, unarchived wishes visible to the recipient are counted (AD-7, D-49).
 */

const BATCH_SIZE = 100;

type RecipientsDb = Pick<PrismaClient, "user" | "friendship" | "block" | "$transaction">;

type RecipientRow = {
  readonly id: string;
  readonly timeZone: string | null;
  readonly datesInApp: boolean;
  readonly datesEmail: boolean;
};

type FriendRow = {
  readonly id: string;
  readonly name: string;
  readonly nick: string;
  readonly birthDay: number | null;
  readonly birthMonth: number | null;
};

type Candidate = {
  readonly recipient: RecipientRow;
  readonly friend: FriendRow;
  /** The birthday occurrence the notice is about (`ReminderLog.year`). */
  readonly year: number;
};

/** What the notice needs from a Friend's list; the full card stays inside readWishlist. */
type WishSummary = {
  readonly title: string;
  readonly status: string;
};

/**
 * The one gate of AD-7 is `readWishlist`: it applies `VisibilityPolicy`, so a
 * `SECRET` or archived wish and a hidden list never reach this adapter. The
 * dependency is injectable so the cron rules can be tested without a database.
 */
type ReadFriendWishes = (viewerId: string, ownerId: string) => Promise<readonly WishSummary[]>;

/** The counters the date-reminders cron reports; only numbers reach the route. */
export type DateRemindersResult = {
  readonly sent: number;
  readonly failed: number;
};

export async function processDateReminders(
  now: Date = new Date(),
  db: RecipientsDb = prisma,
  readWishes: ReadFriendWishes = readFriendWishes,
): Promise<DateRemindersResult> {
  let sent = 0;
  let failed = 0;

  let lastId: string | undefined;
  for (;;) {
    const recipients = await scanRecipients(db, lastId);
    if (recipients.length === 0) break;

    const candidates = await readDueCandidates(db, recipients, now);

    for (const candidate of candidates) {
      const { recipient, friend, year } = candidate;
      try {
        const wishes = await readWishes(recipient.id, friend.id);
        // A reservation or a closed wish is not something to offer as a gift
        // idea, so only `OPEN` rows are counted (FR-34, AD-9).
        const visible = wishes.filter(wish => wish.status === "OPEN");
        if (visible.length === 0) continue;
        const created = await queueReminder(db, { recipient, friend, year, visible, now });
        if (created) sent += 1;
      } catch (error) {
        // A missing table/column is a deployment state, not a failed pair: it
        // must reach the route, which skips the run with a 200 (see below).
        if (isSchemaNotMigrated(error)) throw error;
        failed += 1;
        console.error("date-reminders: pair failed", {
          recipientId: recipient.id,
          subjectId: friend.id,
          error: error instanceof Error ? error.name : "unknown",
        });
      }
    }

    if (recipients.length < BATCH_SIZE) break;
    lastId = recipients[recipients.length - 1]!.id;
  }

  return { sent, failed };
}

async function readFriendWishes(viewerId: string, ownerId: string): Promise<readonly WishSummary[]> {
  const list = await readWishlist({ viewer: { id: viewerId }, target: { ownerId } });
  return list?.access === "gifts" ? list.gifts : [];
}

/**
 * Recipients are read in `id` order, one page at a time. The local hour depends
 * on `User.timeZone`, so it cannot narrow the SQL scan; it is checked with the
 * pure date rules after the page is read. A missing zone reads as UTC.
 */
function scanRecipients(db: RecipientsDb, lastId: string | undefined) {
  return db.user.findMany({
    where: {
      remindFriendDates: true,
      ...(lastId === undefined ? {} : { id: { gt: lastId } }),
    },
    select: { id: true, timeZone: true, datesInApp: true, datesEmail: true },
    orderBy: { id: "asc" },
    take: BATCH_SIZE,
  });
}

/**
 * One page is read in a fixed number of queries: friendships, Friend profiles
 * and the blocks around the page. A Friend with the profile switch off or
 * without a birthday is not read at all, so no reminder can be built for them.
 */
async function readDueCandidates(
  db: RecipientsDb,
  recipients: readonly RecipientRow[],
  now: Date,
): Promise<Candidate[]> {
  const recipientIds = recipients.map(recipient => recipient.id);
  const recipientSet = new Set(recipientIds);

  const friendships = await db.friendship.findMany({
    where: {
      OR: [{ userLowId: { in: recipientIds } }, { userHighId: { in: recipientIds } }],
    },
    select: { userLowId: true, userHighId: true },
  });

  const friendIdsByRecipient = new Map<string, string[]>();
  function addFriend(recipientId: string, friendId: string) {
    const ids = friendIdsByRecipient.get(recipientId);
    if (ids) ids.push(friendId);
    else friendIdsByRecipient.set(recipientId, [friendId]);
  }
  for (const row of friendships) {
    if (recipientSet.has(row.userLowId)) addFriend(row.userLowId, row.userHighId);
    if (recipientSet.has(row.userHighId)) addFriend(row.userHighId, row.userLowId);
  }

  const friendIds = [...new Set([...friendIdsByRecipient.values()].flat())];
  if (friendIds.length === 0) return [];

  // AD-29: friends see the birthday only while the profile switch is on. The
  // same read excludes an absent birthday, so nothing later depends on it.
  const friends = await db.user.findMany({
    where: {
      id: { in: friendIds },
      profileVisibleToFriends: true,
      birthDay: { not: null },
      birthMonth: { not: null },
    },
    select: { id: true, name: true, nick: true, birthDay: true, birthMonth: true },
  });
  const friendById = new Map(friends.map(friend => [friend.id, friend]));

  const blocks = await db.block.findMany({
    where: {
      OR: [
        { blockerId: { in: recipientIds }, blockedId: { in: friendIds } },
        { blockerId: { in: friendIds }, blockedId: { in: recipientIds } },
      ],
    },
    select: { blockerId: true, blockedId: true },
  });
  const blockedPairs = new Set<string>();
  for (const block of blocks) {
    blockedPairs.add(pairKey(block.blockerId, block.blockedId));
    blockedPairs.add(pairKey(block.blockedId, block.blockerId));
  }

  const candidates: Candidate[] = [];
  for (const recipient of recipients) {
    const moment = recipientLocalMoment(now, recipient.timeZone);
    if (moment.hour < DATE_REMINDER_HOUR) continue;
    // Story 7.2 (FR-36): no channel — nothing to deliver, and no log row, so
    // a switch turned on later on the same local day can still send it.
    if (!recipient.datesInApp && !recipient.datesEmail) continue;

    for (const friendId of friendIdsByRecipient.get(recipient.id) ?? []) {
      const friend = friendById.get(friendId);
      if (!friend || friend.birthDay === null || friend.birthMonth === null) continue;
      if (blockedPairs.has(pairKey(recipient.id, friend.id))) continue;
      const year = dueBirthdayReminderYear(
        friend.birthDay,
        friend.birthMonth,
        BIRTHDAY_FRIEND_REMINDER_DAYS,
        now,
        recipient.timeZone,
      );
      if (year === null) continue;
      candidates.push({ recipient, friend, year });
    }
  }

  return candidates;
}

/**
 * The log row and the notice commit together. `skipDuplicates` answers `0` for
 * a second run in the same birthday year, and then nothing else is written, so
 * a repeated hourly run leaves exactly one `Notification`.
 */
async function queueReminder(
  db: RecipientsDb,
  { recipient, friend, year, visible, now }: Candidate & {
    readonly visible: readonly WishSummary[];
    readonly now: Date;
  },
): Promise<boolean> {
  return db.$transaction(async function queueDateReminder(tx) {
    const { count } = await tx.reminderLog.createMany({
      data: {
        recipientId: recipient.id,
        subjectId: friend.id,
        year,
        kind: "BIRTHDAY_FRIEND",
      },
      skipDuplicates: true,
    });
    if (count === 0) return false;

    const titles = visible.slice(0, 3).map(wish => wish.title);
    await enqueueNotification(tx, {
      // One notice per recipient, Friend and birthday year. It mirrors the
      // ReminderLog key, so a row left behind by an older run is not repeated.
      eventKey: `DATE_FRIEND:${friend.id}:${year}`,
      kind: "DATE_FRIEND",
      actorId: friend.id,
      recipientId: recipient.id,
      createdAt: now,
      deliverAfter: now,
      emailRequired: recipient.datesEmail,
      payload: {
        personName: friend.name,
        personNick: friend.nick,
        // AD-27: a machine-readable date-only value; the client hides the year.
        date: birthdayDayInYear(friend.birthDay!, friend.birthMonth!, year),
        count: visible.length,
        titles,
      },
    });
    return true;
  });
}

function pairKey(left: string, right: string) {
  return `${left}\u0000${right}`;
}
