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
  remindOwnList?: boolean;
  birthDay?: number | null;
  birthMonth?: number | null;
  profileVisibleToFriends?: boolean;
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

type TestDate = {
  id: string;
  userId: string;
  title?: string;
  day: number;
  month: number;
  year?: number | null;
  visibility?: "ONLY_ME" | "FRIENDS" | "EVERYONE";
  yearVisibility?: "ONLY_ME" | "FRIENDS" | "EVERYONE";
};

const now = new Date("2026-11-27T12:00:00.000Z");

function createDateRemindersDb(input: {
  recipients: TestRecipient[];
  friends: TestFriend[];
  friendships?: { userLowId: string; userHighId: string }[];
  blocks?: TestBlock[];
  gifts?: TestGift[];
  dates?: TestDate[];
  failFor?: readonly string[];
}) {
  const logs = new Set<string>();
  const notifications: Record<string, unknown>[] = [];
  const failFor = new Set(input.failFor ?? []);
  const friendships = input.friendships ?? [];
  const blocks = input.blocks ?? [];
  const gifts = input.gifts ?? [];
  const dates = input.dates ?? [];

  const db = {
    user: {
      findMany: vi.fn(async function findMany(args: {
        where: {
          remindFriendDates?: boolean;
          remindOwnList?: boolean;
          OR?: { remindFriendDates?: boolean; remindOwnList?: boolean }[];
          id?: { in?: string[]; gt?: string };
        };
        take?: number;
      }) {
        // The page read of Friend profiles: every accepted Friend in one query;
        // the birthday rules filter the profile switch and the birthday itself.
        if (args.where.id?.in !== undefined) {
          const ids = args.where.id.in;
          return input.friends
            .filter(friend => ids.includes(friend.id))
            .map(friend => ({
              id: friend.id,
              name: friend.name ?? "Друг",
              nick: friend.nick ?? friend.id,
              birthDay: friend.birthDay ?? null,
              birthMonth: friend.birthMonth ?? null,
              profileVisibleToFriends: friend.profileVisibleToFriends !== false,
            }));
        }
        // Mirrors `OR: [{ remindFriendDates: true }, { remindOwnList: true }]`:
        // a user with both reminder types off is not scanned at all.
        return input.recipients
          .filter(recipient => recipient.remindFriendDates !== false || recipient.remindOwnList !== false)
          .filter(recipient => !args.where.id?.gt || recipient.id > args.where.id.gt)
          .sort((left, right) => left.id.localeCompare(right.id))
          .slice(0, args.take ?? 100)
          .map(recipient => ({
            id: recipient.id,
            timeZone: recipient.timeZone ?? null,
            datesInApp: recipient.datesInApp !== false,
            datesEmail: recipient.datesEmail !== false,
            remindFriendDates: recipient.remindFriendDates !== false,
            remindOwnList: recipient.remindOwnList !== false,
            birthDay: recipient.birthDay ?? null,
            birthMonth: recipient.birthMonth ?? null,
          }));
      }),
    },
    userDate: {
      findMany: vi.fn(async function findMany(args: {
        where: { userId: { in: string[] }; visibility?: { not: string } };
      }) {
        const ids = args.where.userId.in;
        return dates
          .filter(date => ids.includes(date.userId))
          .filter(date => !args.where.visibility || (date.visibility ?? "FRIENDS") !== args.where.visibility.not)
          .map(date => ({
            id: date.id,
            userId: date.userId,
            kind: "CUSTOM" as const,
            title: date.title ?? "Дата",
            day: date.day,
            month: date.month,
            year: date.year ?? null,
            visibility: date.visibility ?? "FRIENDS",
            yearVisibility: date.yearVisibility ?? "ONLY_ME",
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

/** A personal date of the Friend, 14 days before `now` (11 December 2026). */
function personalDate(overrides: Partial<TestDate> = {}): TestDate {
  return { id: "date", userId: "friend", title: "Годовщина", day: 11, month: 12, visibility: "FRIENDS", ...overrides };
}

/** A Friend without a birthday: the personal-date pass is the only candidate. */
function dateFriend(overrides: Partial<TestFriend> = {}): TestFriend {
  return friend({ birthDay: null, birthMonth: null, ...overrides });
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

    await expect(processDateReminders(now, db, readWishes)).resolves.toEqual({ sentFriendDates: 1, sentOwnDates: 0, failed: 0 });

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

    await expect(processDateReminders(now, db, readWishes)).resolves.toEqual({ sentFriendDates: 1, sentOwnDates: 0, failed: 0 });
    await expect(processDateReminders(now, db, readWishes)).resolves.toEqual({ sentFriendDates: 0, sentOwnDates: 0, failed: 0 });
    expect(logs.size).toBe(1);
    expect(notifications).toHaveLength(1);
  });

  it("sends nothing without an open wish", async function noWishes() {
    const { db, readWishes, notifications, logs } = createDateRemindersDb({
      recipients: [recipient()],
      friends: [friend()],
      friendships: [friendship()],
    });

    await expect(processDateReminders(now, db, readWishes)).resolves.toEqual({ sentFriendDates: 0, sentOwnDates: 0, failed: 0 });
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

    await expect(processDateReminders(now, db, readWishes)).resolves.toEqual({ sentFriendDates: 0, sentOwnDates: 0, failed: 0 });
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

    await expect(processDateReminders(now, db, readWishes)).resolves.toEqual({ sentFriendDates: 0, sentOwnDates: 0, failed: 0 });
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

    await expect(processDateReminders(now, db, readWishes)).resolves.toEqual({ sentFriendDates: 0, sentOwnDates: 0, failed: 0 });
    expect(notifications).toHaveLength(0);
    expect(readWishes).not.toHaveBeenCalled();
  });

  it("sends nothing to a subscriber who is not a Friend", async function notFriends() {
    const { db, readWishes, notifications } = createDateRemindersDb({
      recipients: [recipient()],
      friends: [friend()],
      gifts: [wish()],
    });

    await expect(processDateReminders(now, db, readWishes)).resolves.toEqual({ sentFriendDates: 0, sentOwnDates: 0, failed: 0 });
    expect(notifications).toHaveLength(0);
  });

  it("sends nothing while the recipient switched the reminder type off", async function switchOff() {
    const { db, readWishes, notifications } = createDateRemindersDb({
      recipients: [recipient({ remindFriendDates: false })],
      friends: [friend()],
      friendships: [friendship()],
      gifts: [wish()],
    });

    await expect(processDateReminders(now, db, readWishes)).resolves.toEqual({ sentFriendDates: 0, sentOwnDates: 0, failed: 0 });
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
    ).resolves.toEqual({ sentFriendDates: 0, sentOwnDates: 0, failed: 0 });
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
    ).resolves.toEqual({ sentFriendDates: 1, sentOwnDates: 0, failed: 0 });
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
    ).resolves.toEqual({ sentFriendDates: 1, sentOwnDates: 0, failed: 0 });
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

    await expect(processDateReminders(now, db, readWishes)).resolves.toEqual({ sentFriendDates: 1, sentOwnDates: 0, failed: 1 });
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

describe("Story 7.4: the own birthday reminder", () => {
  /** A birthday of 27 December is exactly 30 days after `now` (27 November). */
  function ownBirthday(overrides: Partial<TestRecipient> = {}): TestRecipient {
    return recipient({ birthDay: 27, birthMonth: 12, ...overrides });
  }

  it("writes one log and one notice, and nothing on a repeated run", async function onceAYear() {
    const { db, readWishes, notifications, logs } = createDateRemindersDb({
      recipients: [ownBirthday()],
      friends: [],
    });

    await expect(processDateReminders(now, db, readWishes))
      .resolves.toEqual({ sentFriendDates: 0, sentOwnDates: 1, failed: 0 });
    await expect(processDateReminders(now, db, readWishes))
      .resolves.toEqual({ sentFriendDates: 0, sentOwnDates: 0, failed: 0 });

    expect(logs.size).toBe(1);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      eventKey: "DATE_OWN:recipient:2026",
      kind: "DATE_OWN",
      recipientId: "recipient",
      emailRequired: true,
      payload: {},
    });
    // The own notice never reads anyone's wishlist.
    expect(readWishes).not.toHaveBeenCalled();
  });

  it("sends nothing when the birthday is not 30 days away", async function wrongDay() {
    const { db, readWishes, notifications } = createDateRemindersDb({
      recipients: [ownBirthday({ birthDay: 28 })],
      friends: [],
    });

    await expect(processDateReminders(now, db, readWishes))
      .resolves.toEqual({ sentFriendDates: 0, sentOwnDates: 0, failed: 0 });
    expect(notifications).toHaveLength(0);
  });

  it("waits for 10:00 in the recipient's own zone", async function beforeTen() {
    const { db, readWishes, notifications } = createDateRemindersDb({
      recipients: [ownBirthday({ timeZone: "Europe/Minsk" })],
      friends: [],
    });

    // 06:59 UTC is 09:59 in Minsk in November.
    await expect(processDateReminders(new Date("2026-11-27T06:59:00.000Z"), db, readWishes))
      .resolves.toEqual({ sentFriendDates: 0, sentOwnDates: 0, failed: 0 });
    expect(notifications).toHaveLength(0);

    await expect(processDateReminders(new Date("2026-11-27T07:00:00.000Z"), db, readWishes))
      .resolves.toEqual({ sentFriendDates: 0, sentOwnDates: 1, failed: 0 });
    expect(notifications).toHaveLength(1);
  });

  it("sends nothing while the own-list switch is off", async function switchOff() {
    const { db, readWishes, notifications, logs } = createDateRemindersDb({
      recipients: [ownBirthday({ remindOwnList: false })],
      friends: [],
    });

    await expect(processDateReminders(now, db, readWishes))
      .resolves.toEqual({ sentFriendDates: 0, sentOwnDates: 0, failed: 0 });
    expect(logs.size).toBe(0);
    expect(notifications).toHaveLength(0);
  });

  it("sends nothing without a birthday on the profile", async function noBirthday() {
    const { db, readWishes, notifications } = createDateRemindersDb({
      recipients: [recipient()],
      friends: [],
    });

    await expect(processDateReminders(now, db, readWishes))
      .resolves.toEqual({ sentFriendDates: 0, sentOwnDates: 0, failed: 0 });
    expect(notifications).toHaveLength(0);
  });

  it("sends nothing when both channels are off", async function noChannels() {
    const { db, readWishes, notifications, logs } = createDateRemindersDb({
      recipients: [ownBirthday({ datesInApp: false, datesEmail: false })],
      friends: [],
    });

    await expect(processDateReminders(now, db, readWishes))
      .resolves.toEqual({ sentFriendDates: 0, sentOwnDates: 0, failed: 0 });
    expect(logs.size).toBe(0);
    expect(notifications).toHaveLength(0);
  });

  it("sends the notice while the birthday is hidden from Friends", async function hiddenProfile() {
    const { db, readWishes, notifications } = createDateRemindersDb({
      recipients: [ownBirthday({ profileVisibleToFriends: false })],
      friends: [],
    });

    await expect(processDateReminders(now, db, readWishes))
      .resolves.toEqual({ sentFriendDates: 0, sentOwnDates: 1, failed: 0 });
    expect(notifications[0]).toMatchObject({ kind: "DATE_OWN" });
  });

  it("sends the notice to an empty wishlist", async function emptyList() {
    const { db, readWishes, notifications } = createDateRemindersDb({
      recipients: [ownBirthday()],
      friends: [],
      gifts: [],
    });

    await expect(processDateReminders(now, db, readWishes))
      .resolves.toEqual({ sentFriendDates: 0, sentOwnDates: 1, failed: 0 });
    expect(notifications).toHaveLength(1);
  });

  it("observes a 29 February birthday on 28 February in a non-leap year", async function leapDay() {
    const { db, readWishes, notifications } = createDateRemindersDb({
      recipients: [recipient({ birthDay: 29, birthMonth: 2 })],
      friends: [],
    });

    await expect(processDateReminders(new Date("2027-01-29T12:00:00.000Z"), db, readWishes))
      .resolves.toEqual({ sentFriendDates: 0, sentOwnDates: 1, failed: 0 });
    expect(notifications[0]).toMatchObject({
      eventKey: "DATE_OWN:recipient:2027",
      kind: "DATE_OWN",
    });
  });

  it("keeps the birthday year across the calendar boundary", async function yearBoundary() {
    const { db, readWishes, notifications } = createDateRemindersDb({
      recipients: [recipient({ birthDay: 1, birthMonth: 1 })],
      friends: [],
    });

    // 2 December 2026 is 30 days before 1 January 2027.
    await expect(processDateReminders(new Date("2026-12-02T12:00:00.000Z"), db, readWishes))
      .resolves.toEqual({ sentFriendDates: 0, sentOwnDates: 1, failed: 0 });
    expect(notifications[0]).toMatchObject({
      eventKey: "DATE_OWN:recipient:2027",
      kind: "DATE_OWN",
    });
  });

  it("counts the Friend and own notices of one run separately", async function bothPasses() {
    const { db, readWishes, notifications } = createDateRemindersDb({
      recipients: [ownBirthday()],
      friends: [friend()],
      friendships: [friendship()],
      gifts: [wish()],
    });

    await expect(processDateReminders(now, db, readWishes))
      .resolves.toEqual({ sentFriendDates: 1, sentOwnDates: 1, failed: 0 });
    expect(notifications.map(row => row.kind)).toEqual(["DATE_FRIEND", "DATE_OWN"]);
  });
});
describe("Story 7.6: the personal date reminder", () => {
  it("writes one DATE_CUSTOM log and one notice for a date the Friend sees", async function allConditions() {
    const { db, readWishes, notifications, logs } = createDateRemindersDb({
      recipients: [recipient()],
      friends: [dateFriend()],
      friendships: [friendship()],
      gifts: [wish()],
      dates: [personalDate()],
    });

    await expect(processDateReminders(now, db, readWishes))
      .resolves.toEqual({ sentFriendDates: 1, sentOwnDates: 0, failed: 0 });

    expect(logs.size).toBe(1);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      eventKey: "DATE_CUSTOM:date:2026",
      kind: "DATE_CUSTOM",
      actorId: "friend",
      recipientId: "recipient",
      emailRequired: true,
      payload: {
        personName: "Анна",
        personNick: "anna",
        dateId: "date",
        date: "2026-12-11",
        dateTitle: "Годовщина",
        count: 1,
        titles: ["Книга"],
      },
    });
    // The owner of the date is the sender, never a recipient.
    expect(notifications[0]?.recipientId).not.toBe("friend");
  });

  it("sends nothing on a repeated run in the same year", async function repeatedRun() {
    const { db, readWishes, notifications, logs } = createDateRemindersDb({
      recipients: [recipient()],
      friends: [dateFriend()],
      friendships: [friendship()],
      gifts: [wish()],
      dates: [personalDate()],
    });

    await expect(processDateReminders(now, db, readWishes))
      .resolves.toEqual({ sentFriendDates: 1, sentOwnDates: 0, failed: 0 });
    await expect(processDateReminders(now, db, readWishes))
      .resolves.toEqual({ sentFriendDates: 0, sentOwnDates: 0, failed: 0 });
    expect(logs.size).toBe(1);
    expect(notifications).toHaveLength(1);
  });

  it("sends nothing for a date that is visible only to its owner", async function onlyMe() {
    const { db, readWishes, notifications, logs } = createDateRemindersDb({
      recipients: [recipient()],
      friends: [dateFriend()],
      friendships: [friendship()],
      gifts: [wish()],
      dates: [personalDate({ visibility: "ONLY_ME" })],
    });

    await expect(processDateReminders(now, db, readWishes))
      .resolves.toEqual({ sentFriendDates: 0, sentOwnDates: 0, failed: 0 });
    expect(logs.size).toBe(0);
    expect(notifications).toHaveLength(0);
    expect(readWishes).not.toHaveBeenCalled();
  });

  it("sends nothing to a subscriber who is not a Friend", async function subscriber() {
    const { db, readWishes, notifications, logs } = createDateRemindersDb({
      recipients: [recipient()],
      friends: [dateFriend()],
      gifts: [wish({ visibility: "PUBLIC" })],
      dates: [personalDate({ visibility: "EVERYONE" })],
    });

    await expect(processDateReminders(now, db, readWishes))
      .resolves.toEqual({ sentFriendDates: 0, sentOwnDates: 0, failed: 0 });
    expect(logs.size).toBe(0);
    expect(notifications).toHaveLength(0);
  });

  it("sends nothing without an open wish visible to the recipient", async function noOpenWish() {
    const { db, readWishes, notifications, logs } = createDateRemindersDb({
      recipients: [recipient()],
      friends: [dateFriend()],
      friendships: [friendship()],
      gifts: [wish({ status: "RESERVED" })],
      dates: [personalDate()],
    });

    await expect(processDateReminders(now, db, readWishes))
      .resolves.toEqual({ sentFriendDates: 0, sentOwnDates: 0, failed: 0 });
    expect(logs.size).toBe(0);
    expect(notifications).toHaveLength(0);
  });

  it("sends nothing while the recipient switched the reminder type off", async function switchOff() {
    const { db, readWishes, notifications } = createDateRemindersDb({
      recipients: [recipient({ remindFriendDates: false })],
      friends: [dateFriend()],
      friendships: [friendship()],
      gifts: [wish()],
      dates: [personalDate()],
    });

    await expect(processDateReminders(now, db, readWishes))
      .resolves.toEqual({ sentFriendDates: 0, sentOwnDates: 0, failed: 0 });
    expect(notifications).toHaveLength(0);
  });

  it("sends a visible date even while the Friend hides the profile fields", async function hiddenProfile() {
    const { db, readWishes, notifications } = createDateRemindersDb({
      recipients: [recipient()],
      friends: [dateFriend({ profileVisibleToFriends: false })],
      friendships: [friendship()],
      gifts: [wish()],
      dates: [personalDate()],
    });

    await expect(processDateReminders(now, db, readWishes))
      .resolves.toEqual({ sentFriendDates: 1, sentOwnDates: 0, failed: 0 });
    expect(notifications[0]).toMatchObject({ kind: "DATE_CUSTOM" });
  });

  it("waits for 10:00 in the recipient's own zone", async function happyHour() {
    const { db, readWishes, notifications } = createDateRemindersDb({
      recipients: [recipient({ timeZone: "Europe/Minsk" })],
      friends: [dateFriend()],
      friendships: [friendship()],
      gifts: [wish()],
      dates: [personalDate()],
    });

    // 06:59 UTC is 09:59 in Minsk in November.
    await expect(processDateReminders(new Date("2026-11-27T06:59:00.000Z"), db, readWishes))
      .resolves.toEqual({ sentFriendDates: 0, sentOwnDates: 0, failed: 0 });
    expect(notifications).toHaveLength(0);

    await expect(processDateReminders(new Date("2026-11-27T07:00:00.000Z"), db, readWishes))
      .resolves.toEqual({ sentFriendDates: 1, sentOwnDates: 0, failed: 0 });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ kind: "DATE_CUSTOM", payload: { date: "2026-12-11" } });
  });

  it("observes 29 February on 28 February in a non-leap year", async function leapDay() {
    const { db, readWishes, notifications } = createDateRemindersDb({
      recipients: [recipient()],
      friends: [dateFriend()],
      friendships: [friendship()],
      gifts: [wish()],
      dates: [personalDate({ day: 29, month: 2 })],
    });

    await expect(
      processDateReminders(new Date("2027-02-14T12:00:00.000Z"), db, readWishes),
    ).resolves.toEqual({ sentFriendDates: 1, sentOwnDates: 0, failed: 0 });
    expect(notifications[0]).toMatchObject({
      eventKey: "DATE_CUSTOM:date:2027",
      payload: { date: "2027-02-28" },
    });
  });
});
