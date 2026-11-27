import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () => ({ prisma: {} }));

import { processDateReminders } from "./date-reminders-store";

type TestRecipient = {
  id: string;
  timeZone?: string | null;
  datesInApp?: boolean;
  datesEmail?: boolean;
  remindFriendDates?: boolean;
};

type TestFriend = {
  id: string;
  name?: string;
  nick?: string;
  birthDay?: number | null;
  birthMonth?: number | null;
  profileVisibleToFriends?: boolean;
};

type TestGift = {
  id: string;
  title: string;
  ownerId: string;
  status?: "OPEN" | "RESERVED" | "CLOSED";
  archivedAt?: Date | null;
  visibility?: "PUBLIC" | "FRIENDS" | "SECRET";
};

type TestBlock = { blockerId: string; blockedId: string };

const now = new Date("2026-11-27T12:00:00.000Z");

function createDateRemindersDb(input: {
  recipients: TestRecipient[];
  friends: TestFriend[];
  friendships?: { userLowId: string; userHighId: string }[];
  blocks?: TestBlock[];
  gifts?: TestGift[];
  failFor?: readonly string[];
}) {
  const logs = new Set<string>();
  const notifications: Record<string, unknown>[] = [];
  const failFor = new Set(input.failFor ?? []);
  const friendships = input.friendships ?? [];
  const blocks = input.blocks ?? [];
  const gifts = input.gifts ?? [];

  const db = {
    user: {
      findMany: vi.fn(async function findMany(args: {
        where: {
          remindFriendDates?: boolean;
          id?: { in?: string[]; gt?: string };
          profileVisibleToFriends?: boolean;
          birthDay?: { not: null };
          birthMonth?: { not: null };
        };
        take?: number;
      }) {
        if (args.where.profileVisibleToFriends !== undefined) {
          const ids = args.where.id?.in ?? [];
          return input.friends
            .filter(friend =>
              ids.includes(friend.id) &&
              friend.profileVisibleToFriends !== false &&
              friend.birthDay !== null && friend.birthDay !== undefined &&
              friend.birthMonth !== null && friend.birthMonth !== undefined)
            .map(friend => ({
              id: friend.id,
              name: friend.name ?? "Друг",
              nick: friend.nick ?? friend.id,
              birthDay: friend.birthDay,
              birthMonth: friend.birthMonth,
            }));
        }
        return input.recipients
          .filter(recipient => recipient.remindFriendDates !== false)
          .filter(recipient => !args.where.id?.gt || recipient.id > args.where.id.gt)
          .sort((left, right) => left.id.localeCompare(right.id))
          .slice(0, args.take ?? 100)
          .map(recipient => ({
            id: recipient.id,
            timeZone: recipient.timeZone ?? null,
            datesInApp: recipient.datesInApp !== false,
            datesEmail: recipient.datesEmail !== false,
          }));
      }),
    },
    friendship: {
      findMany: vi.fn(async function findMany() {
        return friendships;
      }),
    },
    block: {
      findMany: vi.fn(async function findMany() {
        return blocks;
      }),
    },
    $transaction: vi.fn(async function transaction(work: (tx: unknown) => Promise<unknown>) {
      return work({
        reminderLog: {
          createMany: vi.fn(async function createMany(args: {
            data: { recipientId: string; subjectId: string; year: number; kind: string };
          }) {
            if (failFor.has(args.data.subjectId)) throw new Error("boom");
            const key = `${args.data.recipientId}\u0000${args.data.subjectId}\u0000${args.data.year}\u0000${args.data.kind}`;
            if (logs.has(key)) return { count: 0 };
            logs.add(key);
            return { count: 1 };
          }),
        },
        notification: {
          createMany: vi.fn(async function createMany(args: { data: Record<string, unknown> }) {
            notifications.push(args.data);
            return { count: 1 };
          }),
        },
      });
    }),
  };

  // Stands in for `readWishlist`: a hidden (`SECRET`) or archived wish never
  // leaves the gate, while `RESERVED`/`CLOSED` rows do and are filtered by the
  // cron itself.
  const readWishes = vi.fn(async function readWishes(_viewerId: string, ownerId: string) {
    return gifts
      .filter(gift =>
        gift.ownerId === ownerId &&
        (gift.archivedAt ?? null) === null &&
        (gift.visibility ?? "PUBLIC") !== "SECRET")
      .map(gift => ({ title: gift.title, status: gift.status ?? "OPEN" }));
  });

  return {
    db: db as unknown as NonNullable<Parameters<typeof processDateReminders>[1]>,
    readWishes,
    notifications,
    logs,
  };
}

function recipient(overrides: Partial<TestRecipient> = {}): TestRecipient {
  return { id: "recipient", timeZone: "UTC", ...overrides };
}

function friend(overrides: Partial<TestFriend> = {}): TestFriend {
  return {
    id: "friend",
    name: "Анна",
    nick: "anna",
    birthDay: 11,
    birthMonth: 12,
    ...overrides,
  };
}

function friendship(recipientId = "recipient", friendId = "friend") {
  const [userLowId, userHighId] = [recipientId, friendId].sort();
  return { userLowId: userLowId!, userHighId: userHighId! };
}

function wish(overrides: Partial<TestGift> = {}): TestGift {
  return { id: "wish", title: "Книга", ownerId: "friend", visibility: "FRIENDS", ...overrides };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Story 7.3: processDateReminders", () => {
  it("writes one reminder log and one notification when every FR-34 condition holds", async function allConditions() {
    const { db, readWishes, notifications, logs } = createDateRemindersDb({
      recipients: [recipient()],
      friends: [friend()],
      friendships: [friendship()],
      gifts: [wish()],
    });

    await expect(processDateReminders(now, db, readWishes)).resolves.toEqual({ sent: 1, failed: 0 });

    expect(logs.size).toBe(1);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      eventKey: "DATE_FRIEND:friend:2026",
      kind: "DATE_FRIEND",
      actorId: "friend",
      recipientId: "recipient",
      emailRequired: true,
      payload: {
        personName: "Анна",
        personNick: "anna",
        date: "2026-12-11",
        count: 1,
        titles: ["Книга"],
      },
    });
  });

  it("sends nothing on a repeated run", async function repeatedRun() {
    const { db, readWishes, notifications, logs } = createDateRemindersDb({
      recipients: [recipient()],
      friends: [friend()],
      friendships: [friendship()],
      gifts: [wish()],
    });

    await expect(processDateReminders(now, db, readWishes)).resolves.toEqual({ sent: 1, failed: 0 });
    await expect(processDateReminders(now, db, readWishes)).resolves.toEqual({ sent: 0, failed: 0 });
    expect(logs.size).toBe(1);
    expect(notifications).toHaveLength(1);
  });

  it("sends nothing without an open wish", async function noWishes() {
    const { db, readWishes, notifications, logs } = createDateRemindersDb({
      recipients: [recipient()],
      friends: [friend()],
      friendships: [friendship()],
    });

    await expect(processDateReminders(now, db, readWishes)).resolves.toEqual({ sent: 0, failed: 0 });
    expect(logs.size).toBe(0);
    expect(notifications).toHaveLength(0);
  });

  it("ignores reserved, closed, archived and secret wishes", async function hiddenWishes() {
    const { db, readWishes, notifications, logs } = createDateRemindersDb({
      recipients: [recipient()],
      friends: [friend()],
      friendships: [friendship()],
      gifts: [
        wish({ id: "reserved", status: "RESERVED" }),
        wish({ id: "closed", status: "CLOSED" }),
        wish({ id: "archived", archivedAt: new Date("2026-11-01T00:00:00Z") }),
        wish({ id: "secret", visibility: "SECRET" }),
      ],
    });

    await expect(processDateReminders(now, db, readWishes)).resolves.toEqual({ sent: 0, failed: 0 });
    expect(logs.size).toBe(0);
    expect(notifications).toHaveLength(0);
  });

  it("counts every visible wish but keeps at most three titles", async function visibleTitles() {
    const { db, readWishes, notifications } = createDateRemindersDb({
      recipients: [recipient()],
      friends: [friend()],
      friendships: [friendship()],
      gifts: [
        wish({ id: "one", title: "Книга" }),
        wish({ id: "two", title: "Плед", visibility: "PUBLIC" }),
        wish({ id: "three", title: "Кружка" }),
        wish({ id: "four", title: "Наушники" }),
      ],
    });

    await processDateReminders(now, db, readWishes);
    expect(notifications[0]?.payload).toMatchObject({
      count: 4,
      titles: ["Книга", "Плед", "Кружка"],
    });
  });

  it("sends nothing while the Friend hides the profile", async function hiddenBirthday() {
    const { db, readWishes, notifications, logs } = createDateRemindersDb({
      recipients: [recipient()],
      friends: [friend({ profileVisibleToFriends: false })],
      friendships: [friendship()],
      gifts: [wish()],
    });

    await expect(processDateReminders(now, db, readWishes)).resolves.toEqual({ sent: 0, failed: 0 });
    expect(logs.size).toBe(0);
    expect(notifications).toHaveLength(0);
    expect(readWishes).not.toHaveBeenCalled();
  });

  it.each<[string, TestBlock]>([
    ["the recipient", { blockerId: "recipient", blockedId: "friend" }],
    ["the Friend", { blockerId: "friend", blockedId: "recipient" }],
  ])("sends nothing when %s blocked the other side", async function blocked(_side, block) {
    const { db, readWishes, notifications } = createDateRemindersDb({
      recipients: [recipient()],
      friends: [friend()],
      friendships: [friendship()],
      blocks: [block],
      gifts: [wish()],
    });

    await expect(processDateReminders(now, db, readWishes)).resolves.toEqual({ sent: 0, failed: 0 });
    expect(notifications).toHaveLength(0);
    expect(readWishes).not.toHaveBeenCalled();
  });

  it("sends nothing to a subscriber who is not a Friend", async function notFriends() {
    const { db, readWishes, notifications } = createDateRemindersDb({
      recipients: [recipient()],
      friends: [friend()],
      gifts: [wish()],
    });

    await expect(processDateReminders(now, db, readWishes)).resolves.toEqual({ sent: 0, failed: 0 });
    expect(notifications).toHaveLength(0);
  });

  it("sends nothing while the recipient switched the reminder type off", async function switchOff() {
    const { db, readWishes, notifications } = createDateRemindersDb({
      recipients: [recipient({ remindFriendDates: false })],
      friends: [friend()],
      friendships: [friendship()],
      gifts: [wish()],
    });

    await expect(processDateReminders(now, db, readWishes)).resolves.toEqual({ sent: 0, failed: 0 });
    expect(notifications).toHaveLength(0);
  });

  it("sends nothing before 10:00 in the recipient's zone", async function beforeTen() {
    const { db, readWishes, notifications } = createDateRemindersDb({
      recipients: [recipient({ timeZone: "Europe/Minsk" })],
      friends: [friend()],
      friendships: [friendship()],
      gifts: [wish()],
    });

    await expect(
      processDateReminders(new Date("2026-11-27T06:59:00.000Z"), db, readWishes),
    ).resolves.toEqual({ sent: 0, failed: 0 });
    expect(notifications).toHaveLength(0);
  });

  it("observes 29 February on 28 February in a non-leap year", async function leapDay() {
    const { db, readWishes, notifications } = createDateRemindersDb({
      recipients: [recipient()],
      friends: [friend({ birthDay: 29, birthMonth: 2 })],
      friendships: [friendship()],
      gifts: [wish()],
    });

    await expect(
      processDateReminders(new Date("2027-02-14T12:00:00.000Z"), db, readWishes),
    ).resolves.toEqual({ sent: 1, failed: 0 });
    expect(notifications[0]).toMatchObject({
      eventKey: "DATE_FRIEND:friend:2027",
      payload: { date: "2027-02-28" },
    });
  });

  it("keeps the birthday year across the calendar boundary", async function yearBoundary() {
    const { db, readWishes, notifications } = createDateRemindersDb({
      recipients: [recipient()],
      friends: [friend({ birthDay: 1, birthMonth: 1 })],
      friendships: [friendship()],
      gifts: [wish()],
    });

    await expect(
      processDateReminders(new Date("2026-12-18T12:00:00.000Z"), db, readWishes),
    ).resolves.toEqual({ sent: 1, failed: 0 });
    expect(notifications[0]).toMatchObject({
      eventKey: "DATE_FRIEND:friend:2027",
      payload: { date: "2027-01-01" },
    });
  });

  it("logs one failed pair by ids and keeps sending the rest", async function onePairFails() {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { db, readWishes, notifications } = createDateRemindersDb({
      recipients: [recipient()],
      friends: [friend({ id: "friend-two", name: "Мария", nick: "maria" }), friend()],
      friendships: [friendship("recipient", "friend"), friendship("recipient", "friend-two")],
      gifts: [
        wish({ id: "one", ownerId: "friend" }),
        wish({ id: "two", ownerId: "friend-two", title: "Плед" }),
      ],
      failFor: ["friend"],
    });

    await expect(processDateReminders(now, db, readWishes)).resolves.toEqual({ sent: 1, failed: 1 });
    expect(notifications).toHaveLength(1);
    const logged = JSON.stringify(spy.mock.calls);
    expect(logged).toContain("recipient");
    expect(logged).toContain("friend");
    expect(logged).toContain("Error");
    expect(logged).not.toContain("Мария");
  });

  it("lets a missing schema object reach the route instead of counting a pair failure", async function schemaError() {
    const { db } = createDateRemindersDb({
      recipients: [recipient()],
      friends: [friend()],
      friendships: [friendship()],
      gifts: [wish()],
    });
    const missingTable = Object.assign(new Error("missing table"), { code: "P2021" });

    await expect(
      processDateReminders(now, db, async function readWishes() {
        throw missingTable;
      }),
    ).rejects.toBe(missingTable);
  });
});
