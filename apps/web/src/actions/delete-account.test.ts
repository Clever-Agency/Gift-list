import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  transaction,
  listFindUnique,
  giftFindUnique,
  friendshipFindUnique,
  blockFindFirst,
  subscriptionFindUnique,
} = vi.hoisted(() => ({
  transaction: vi.fn(),
  listFindUnique: vi.fn(),
  giftFindUnique: vi.fn(),
  friendshipFindUnique: vi.fn(),
  blockFindFirst: vi.fn(),
  subscriptionFindUnique: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  prisma: {
    $transaction: transaction,
    list: { findUnique: listFindUnique },
    gift: { findUnique: giftFindUnique },
    friendship: { findUnique: friendshipFindUnique },
    block: { findFirst: blockFindFirst },
    subscription: { findUnique: subscriptionFindUnique },
  },
}));

import type { NotificationPreferences } from "@gift-list/contracts";
import type { Notification } from "@/db/generated/client";
import { projectNotification } from "@/lib/notification-store";
import { deleteAccount } from "./delete-account";
import { readWishlist } from "./wishlist-read";

const NOW = new Date("2026-11-27T10:00:00.000Z");
const OWNER = "u1";
const HELD_AT = new Date("2026-11-01T09:00:00.000Z");

type Where = Record<string, unknown>;

/** The row shape `notificationGiftSnapshot` reads; the fake keeps it honest. */
type GiftRow = {
  id: string;
  title: string;
  status: "OPEN" | "RESERVED" | "CLOSED";
  reservedById: string | null;
  reservedAt: Date | null;
  reservationPhase: "ACTIVE" | "AWAITING_GIVER" | "AWAITING_OWNER" | "GIVEN" | null;
  reservationPhaseAt: Date | null;
  reservationDueAt: Date | null;
  reservationTimeZone: string | null;
  reservationBought: boolean;
  titleSnapshotOnReserve: string | null;
  expiresOn: Date | null;
  archivedAt: Date | null;
  visibility: "PUBLIC" | "FRIENDS" | "SECRET";
  reservedBy: { timeZone: string | null } | null;
  list: { ownerId: string; owner: { nick: string } };
};

type DbState = {
  user: { id: string; email: string } | null;
  lists: { id: string; ownerId: string; publicToken: string }[];
  gifts: GiftRow[];
  notifications: Where[];
};

let db: DbState;
let calls: string[];
let casLosses: number;
let tx!: ReturnType<typeof transactionFor>;

function plain(value: unknown): Where {
  return value !== null && typeof value === "object" ? (value as Where) : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function giftRow(overrides: Partial<GiftRow> & Pick<GiftRow, "id">): GiftRow {
  return {
    title: "Наушники",
    status: "OPEN",
    reservedById: null,
    reservedAt: null,
    reservationPhase: null,
    reservationPhaseAt: null,
    reservationDueAt: null,
    reservationTimeZone: null,
    reservationBought: false,
    titleSnapshotOnReserve: null,
    expiresOn: null,
    archivedAt: null,
    visibility: "PUBLIC",
    reservedBy: null,
    list: { ownerId: "u9", owner: { nick: "owner" } },
    ...overrides,
  };
}

function reserve(row: GiftRow, holderId: string, snapshot: string): GiftRow {
  return {
    ...row,
    status: "RESERVED",
    reservedById: holderId,
    reservedAt: HELD_AT,
    reservationPhase: "ACTIVE",
    reservationPhaseAt: HELD_AT,
    reservationDueAt: new Date("2026-12-01T21:00:00.000Z"),
    reservationTimeZone: "Europe/Minsk",
    titleSnapshotOnReserve: snapshot,
    reservedBy: { timeZone: "Europe/Minsk" },
  };
}

/**
 * The fake transaction client. It answers the queries the command really makes
 * — the releases, the snapshots, the counts and the `deleteMany` order — and
 * mutates {@link db}, so a rolled back transaction can restore it.
 */
function transactionFor(database: DbState) {
  function deleteManyMock(name: string, apply?: (where: Where) => void) {
    return vi.fn(async function deleteMany(args: { where: Where }) {
      calls.push(name);
      apply?.(args.where);
      return { count: 0 };
    });
  }

  return {
    user: {
      findUnique: vi.fn(async function findUnique(args: { where: Where }) {
        const wanted = text(args.where.id);
        return database.user !== null && database.user.id === wanted
          ? { id: database.user.id, email: database.user.email }
          : null;
      }),
      deleteMany: vi.fn(async function deleteMany() {
        calls.push("user");
        const existed = database.user !== null;
        database.user = null;
        return { count: existed ? 1 : 0 };
      }),
    },
    gift: {
      findMany: vi.fn(async function findMany(args: { where: Where }) {
        const holderId = text(args.where.reservedById);
        if (holderId !== null) {
          // Story 6.3: every row that still points at the account.
          return database.gifts
            .filter((row) => row.reservedById === holderId)
            .map((row) => ({ id: row.id }));
        }
        // The wishes of the account whose reservations must be reported.
        const ownerId = text(plain(args.where.list).ownerId);
        return database.gifts
          .filter(
            (row) =>
              ownerId !== null &&
              row.list.ownerId === ownerId &&
              row.status === "RESERVED" &&
              row.reservedById !== null,
          )
          .map((row) => ({ id: row.id }));
      }),
      findUnique: vi.fn(async function findUnique(args: { where: Where }) {
        const id = text(args.where.id);
        return database.gifts.find((row) => row.id === id) ?? null;
      }),
      updateMany: vi.fn(async function updateMany(args: { where: Where; data: Where }) {
        const row = database.gifts.find((item) => item.id === text(args.where.id));
        if (row === undefined) return { count: 0 };
        // A simulated concurrent winner: the CAS finds nothing to write.
        if (casLosses > 0) {
          casLosses -= 1;
          return { count: 0 };
        }
        const status = text(args.where.status);
        if (status !== null && row.status !== status) return { count: 0 };
        const holderId = text(args.where.reservedById);
        if (holderId !== null && row.reservedById !== holderId) return { count: 0 };
        const reservedAt = args.where.reservedAt;
        if (reservedAt instanceof Date && row.reservedAt?.getTime() !== reservedAt.getTime()) {
          return { count: 0 };
        }
        Object.assign(row, args.data);
        return { count: 1 };
      }),
      count: vi.fn(async function count(args: { where: Where }) {
        const holderId = text(args.where.reservedById);
        return database.gifts.filter((row) => holderId !== null && row.reservedById === holderId)
          .length;
      }),
      deleteMany: vi.fn(async function deleteMany(args: { where: Where }) {
        calls.push("gift");
        const ownerId = text(plain(args.where.list).ownerId);
        const before = database.gifts.length;
        if (ownerId !== null) {
          database.gifts = database.gifts.filter((row) => row.list.ownerId !== ownerId);
        }
        return { count: before - database.gifts.length };
      }),
    },
    giftTag: {
      deleteMany: deleteManyMock("giftTag"),
    },
    list: {
      deleteMany: vi.fn(async function deleteMany(args: { where: Where }) {
        calls.push("list");
        const ownerId = text(args.where.ownerId);
        const before = database.lists.length;
        if (ownerId !== null) {
          database.lists = database.lists.filter((row) => row.ownerId !== ownerId);
        }
        return { count: before - database.lists.length };
      }),
    },
    notification: {
      createMany: vi.fn(async function createMany(args: { data: Where | Where[] }) {
        const rows = Array.isArray(args.data) ? args.data : [args.data];
        database.notifications.push(...rows.map((row) => ({ ...row })));
        return { count: rows.length };
      }),
      deleteMany: vi.fn(async function deleteMany(args: { where: Where }) {
        calls.push("notification");
        const recipientId = text(args.where.recipientId);
        if (recipientId !== null) {
          database.notifications = database.notifications.filter(
            (row) => row.recipientId !== recipientId,
          );
        }
        return { count: 0 };
      }),
    },
    inviteLink: { deleteMany: deleteManyMock("inviteLink") },
    friendship: { deleteMany: deleteManyMock("friendship") },
    friendshipInvite: { deleteMany: deleteManyMock("friendshipInvite") },
    block: { deleteMany: deleteManyMock("block") },
    subscription: { deleteMany: deleteManyMock("subscription") },
    inviteCooldown: { deleteMany: deleteManyMock("inviteCooldown") },
    session: { deleteMany: deleteManyMock("session") },
    account: { deleteMany: deleteManyMock("account") },
    verification: { deleteMany: deleteManyMock("verification") },
  };
}

beforeEach(() => {
  db = {
    user: { id: OWNER, email: "me@example.com" },
    lists: [{ id: "l1", ownerId: OWNER, publicToken: "tok" }],
    gifts: [],
    notifications: [],
  };
  calls = [];
  casLosses = 0;

  transaction.mockReset();
  transaction.mockImplementation(
    async function runInTransaction(work: (client: ReturnType<typeof transactionFor>) => Promise<unknown>) {
      const backup = structuredClone(db);
      const callBackup = [...calls];
      tx = transactionFor(db);
      try {
        return await work(tx);
      } catch (error) {
        // R1: a thrown signal rolls the transaction back, data and calls alike.
        db = backup;
        calls = callBackup;
        throw error;
      }
    },
  );
  listFindUnique.mockReset();
  giftFindUnique.mockReset();
  friendshipFindUnique.mockReset();
  blockFindFirst.mockReset();
  subscriptionFindUnique.mockReset();
  listFindUnique.mockImplementation(async function findList(args: { where: Where }) {
    const token = text(args.where.publicToken);
    return db.lists.find((row) => row.publicToken === token) ?? null;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function notificationTo(recipientId: string) {
  return db.notifications.filter((row) => row.recipientId === recipientId);
}

describe("deleteAccount: the reservations of the account (AD-20, D-49)", () => {
  it("releases a live reservation through GiftStatusService and never tells its owner", async () => {
    db.gifts = [reserve(giftRow({ id: "g-held" }), OWNER, "Плед")];
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    const outcome = await deleteAccount(OWNER, { now: NOW });

    expect(outcome).toBe("deleted");
    const released = db.gifts.find((row) => row.id === "g-held");
    expect(released).toMatchObject({ status: "OPEN", reservedById: null, reservedAt: null });
    // D-49/AD-15: the owner of the wish gets nothing; nobody else either.
    expect(db.notifications).toEqual([]);
    // NFR-6: the transition is reported once, with identifiers only.
    expect(info).toHaveBeenCalledTimes(1);
    const line = JSON.parse(String(info.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(line).toEqual({
      event: "gift.account-deletion.released",
      giftId: "g-held",
      actorId: OWNER,
      from: "RESERVED",
      to: "OPEN",
      at: NOW.toISOString(),
    });
  });

  it("drops only the account link of a closed wish, which keeps its closure", async () => {
    const closed = reserve(giftRow({ id: "g-closed" }), OWNER, "Книга");
    db.gifts = [{
      ...closed,
      status: "CLOSED",
      reservationPhase: "GIVEN",
    }];
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    const outcome = await deleteAccount(OWNER, { now: NOW });

    expect(outcome).toBe("deleted");
    const stored = db.gifts.find((row) => row.id === "g-closed");
    expect(stored).toMatchObject({ status: "CLOSED", reservedById: null });
    // No status changed, so there is nothing for the audit seam to report.
    expect(info).not.toHaveBeenCalled();
  });

  it("re-reads a lost CAS and still finishes the deletion", async () => {
    db.gifts = [reserve(giftRow({ id: "g-held" }), OWNER, "Плед")];
    casLosses = 1;

    const outcome = await deleteAccount(OWNER, { now: NOW });

    expect(outcome).toBe("deleted");
    expect(db.gifts.find((row) => row.id === "g-held")?.status).toBe("OPEN");
  });

  it("answers busy and keeps everything when the CAS race never ends", async () => {
    db.gifts = [reserve(giftRow({ id: "g-held" }), OWNER, "Плед")];
    casLosses = 100;

    const outcome = await deleteAccount(OWNER, { now: NOW });

    expect(outcome).toBe("busy");
    // The whole transaction rolled back: no data and no row were removed.
    expect(db.user).toEqual({ id: OWNER, email: "me@example.com" });
    expect(db.gifts[0]).toMatchObject({ status: "RESERVED", reservedById: OWNER });
    expect(calls).toEqual([]);
    expect(db.notifications).toEqual([]);
  });
});

describe("deleteAccount: the holders of reservations on its wishes", () => {
  it("queues one GIFT_DELETED notice per gift and names the reservation snapshot", async () => {
    const owned = { ownerId: OWNER, owner: { nick: "owner" } };
    db.gifts = [
      reserve(giftRow({ id: "g-a", title: "Новое название", list: owned }), "u2", "Книга"),
      reserve(giftRow({ id: "g-b", list: owned }), "u3", "Плед"),
      giftRow({ id: "g-open", list: owned }),
    ];

    const outcome = await deleteAccount(OWNER, { now: NOW });

    expect(outcome).toBe("deleted");
    expect(db.notifications).toHaveLength(2);
    expect(notificationTo("u2")).toEqual([
      expect.objectContaining({
        kind: "GIFT_DELETED",
        giftId: "g-a",
        recipientId: "u2",
        emailRequired: true,
        payload: { role: "holder", titleSnapshot: "Книга" },
      }),
    ]);
    expect(notificationTo("u3")[0]).toMatchObject({
      kind: "GIFT_DELETED",
      giftId: "g-b",
      payload: { role: "holder", titleSnapshot: "Плед" },
    });
    // The deleted account is not a recipient of anything.
    expect(notificationTo(OWNER)).toEqual([]);
  });

  it("keeps the holder's feed working after the account and its wishes are gone", async () => {
    db.gifts = [
      reserve(
        giftRow({ id: "g-a", list: { ownerId: OWNER, owner: { nick: "owner" } } }),
        "u2",
        "Книга",
      ),
    ];
    await deleteAccount(OWNER, { now: NOW });

    const [row] = db.notifications;
    expect(row).toBeDefined();
    giftFindUnique.mockResolvedValue(null);
    friendshipFindUnique.mockResolvedValue(null);
    blockFindFirst.mockResolvedValue(null);
    subscriptionFindUnique.mockResolvedValue(null);
    const prefs: NotificationPreferences = {
      datesInApp: true,
      datesEmail: true,
      wishExpiryInApp: true,
      wishExpiryEmail: true,
      remindFriendDates: true,
      remindOwnList: true,
    };

    const item = await projectNotification(
      { id: "n1", readAt: null, ...row } as unknown as Notification,
      prefs,
      "inApp",
      NOW,
    );

    expect(item).not.toBeNull();
    expect(item?.event).toMatchObject({ kind: "GIFT_DELETED", titleSnapshot: "Книга" });
    expect(item?.href).toBeNull();
  });
});

describe("deleteAccount: the rows of the account", () => {
  it("deletes what points at the user first and the User row last", async () => {
    const outcome = await deleteAccount(OWNER, { now: NOW });

    expect(outcome).toBe("deleted");
    expect(calls).toEqual([
      "giftTag",
      "gift",
      "list",
      "inviteLink",
      "friendship",
      "friendshipInvite",
      "block",
      "subscription",
      "inviteCooldown",
      "notification",
      "session",
      "account",
      "verification",
      "user",
    ]);
    expect(tx.giftTag.deleteMany).toHaveBeenCalledWith({
      where: { gift: { list: { ownerId: OWNER } } },
    });
    expect(tx.gift.deleteMany).toHaveBeenCalledWith({ where: { list: { ownerId: OWNER } } });
    expect(tx.list.deleteMany).toHaveBeenCalledWith({ where: { ownerId: OWNER } });
    expect(tx.inviteLink.deleteMany).toHaveBeenCalledWith({ where: { userId: OWNER } });
    expect(tx.friendship.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ userLowId: OWNER }, { userHighId: OWNER }] },
    });
    expect(tx.friendshipInvite.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ fromUserId: OWNER }, { toUserId: OWNER }] },
    });
    expect(tx.block.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ blockerId: OWNER }, { blockedId: OWNER }] },
    });
    expect(tx.subscription.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ subscriberId: OWNER }, { targetId: OWNER }] },
    });
    expect(tx.inviteCooldown.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [{ userLowId: OWNER }, { userHighId: OWNER }, { rejectedFromUserId: OWNER }],
      },
    });
    expect(tx.notification.deleteMany).toHaveBeenCalledWith({ where: { recipientId: OWNER } });
    expect(tx.session.deleteMany).toHaveBeenCalledWith({ where: { userId: OWNER } });
    expect(tx.account.deleteMany).toHaveBeenCalledWith({ where: { userId: OWNER } });
    expect(tx.verification.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { identifier: "me@example.com" },
          { value: "me@example.com" },
          { value: OWNER },
          { identifier: `change-email:${OWNER}` },
        ],
      },
    });
    expect(tx.user.deleteMany).toHaveBeenCalledWith({ where: { id: OWNER } });
  });

  it("answers already-deleted and writes nothing on a repeated call", async () => {
    db.user = null;

    const outcome = await deleteAccount(OWNER, { now: NOW });

    expect(outcome).toBe("already-deleted");
    expect(calls).toEqual([]);
    expect(db.notifications).toEqual([]);
  });

  it("closes the public link of the list: /l/:token reads no list and answers NOT_FOUND", async () => {
    await deleteAccount(OWNER, { now: NOW });
    listFindUnique.mockClear();

    const list = await readWishlist({
      viewer: null,
      target: { publicToken: "tok" },
      viaListToken: true,
    });

    expect(list).toBeNull();
    expect(listFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { publicToken: "tok" } }),
    );
  });
});
