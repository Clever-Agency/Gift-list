import { beforeEach, describe, expect, it, vi } from "vitest";
import { notificationText, safeNextPath } from "@gift-list/contracts";
import type { Notification } from "@/db/generated/client";

vi.mock("server-only", () => ({}));

const db = vi.hoisted(function database() {
  return {
    notification: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    gift: { findUnique: vi.fn(), updateMany: vi.fn() },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
    user: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
    relationsBetween: vi.fn(),
  };
});

vi.mock("@/lib/auth", function authModule() { return { auth: {} }; });
vi.mock("@/db/client", function client() { return { prisma: db }; });
vi.mock("@/lib/relationships", function relations() { return { relationshipReader: db }; });

import { actOnNotification } from "@/actions/notifications";
import {
  cancelCloseNotification,
  countUnreadNotifications,
  readNotifications,
  enqueueGiftNotification,
  markNotificationRead,
  notificationGiftSnapshot,
  notificationIsActionable,
  projectNotification,
} from "./notification-store";
import { notificationEmailLink, processNotificationEmails } from "./notification-email";

const now = new Date("2026-11-24T12:00:00Z");
const reservedAt = new Date("2026-11-22T12:00:00Z");
const defaults = { datesInApp: true, datesEmail: true, wishExpiryInApp: true, wishExpiryEmail: true };
const gift = {
  id: "gift",
  title: "Текущее название",
  archivedAt: null,
  reservedAt,
  reservedById: "holder",
  reservationPhase: "AWAITING_OWNER",
  reservationPhaseAt: now,
  reservationDueAt: new Date("2026-11-25T21:00:00Z"),
  reservationTimeZone: "Europe/Minsk",
  status: "RESERVED",
  visibility: "SECRET",
  titleSnapshotOnReserve: "Снимок названия",
  holderVisibleToOwner: false,
  reservationBought: true,
  reservedBy: { name: "Скрытый даритель" },
  list: { ownerId: "owner", owner: { nick: "owner" } },
} as const;

function record(changes: Partial<Notification> = {}): Notification {
  return {
    id: "notification",
    recipientId: "owner",
    eventKey: "event",
    kind: "RESERVATION_OWNER_ASK",
    giftId: gift.id,
    actorId: "holder",
    reservationAt: reservedAt,
    phaseAt: now,
    payload: { role: "owner", titleSnapshot: gift.title },
    createdAt: now,
    deliverAfter: now,
    readAt: null,
    emailRequired: true,
    emailFirstAttemptAt: null,
    emailLeaseUntil: null,
    emailDoneAt: null,
    ...changes,
  };
}

beforeEach(function reset() {
  vi.resetAllMocks();
  db.gift.findUnique.mockResolvedValue(gift);
  db.user.findUniqueOrThrow.mockResolvedValue(defaults);
  db.relationsBetween.mockResolvedValue({ blocked: false, friend: false, subscriber: false, contactMatch: false });
});

describe("notification privacy and availability", function privacyTests() {
  it("rechecks FR-31 and omits holder identity, purchase mark and due date from the owner feed", async function hidesFields() {
    const row = record({
      payload: { role: "owner", titleSnapshot: gift.title, holderName: gift.reservedBy.name, bought: true, dueAt: gift.reservationDueAt.toISOString() },
    });
    const item = await projectNotification(row, defaults, "inApp", now);
    expect(item?.event).toEqual({
      kind: row.kind, giftId: gift.id, titleSnapshot: gift.title, actionable: true,
    });
    db.gift.findUnique.mockResolvedValue({ ...gift, holderVisibleToOwner: true });
    expect((await projectNotification(row, defaults, "inApp", now))?.event)
      .toHaveProperty("holderName", gift.reservedBy.name);
  });

  it("keeps the holder's reservation snapshot after losing wishlist access", async function holderOnly() {
    const row = record({
      kind: "RESERVATION_DUE",
      recipientId: "holder",
      actorId: "owner",
      payload: { role: "holder", titleSnapshot: gift.titleSnapshotOnReserve },
    });
    const item = await projectNotification(row, defaults, "inApp", now);
    expect(item?.href).toBe("/reservations");
    expect(item?.event).toHaveProperty("titleSnapshot", gift.titleSnapshotOnReserve);
    expect(JSON.stringify(item)).not.toContain(gift.title);
    expect(item?.event).not.toHaveProperty("bought", true);
    db.gift.findUnique.mockResolvedValue({ ...gift, reservationPhase: "AWAITING_GIVER" });
    expect((await projectNotification(row, defaults, "inApp", now))?.event)
      .toMatchObject({ actionable: true, bought: true });
  });

  it("checks the phase timestamp and reservation instance independently", async function staleSnapshots() {
    const live = await notificationGiftSnapshot(db as never, gift.id);
    expect(notificationIsActionable(record(), live)).toBe(true);
    expect(notificationIsActionable(record({ phaseAt: reservedAt }), live)).toBe(false);
    expect(notificationIsActionable(record({ reservationAt: now }), live)).toBe(false);
    expect(notificationIsActionable(record(), live && { ...live, reservationPhase: "ACTIVE" })).toBe(false);
  });

  it("rejects a stale control before the GiftStatusService CAS", async function rejectStaleMutation() {
    db.$transaction.mockImplementation(async function run(work) { return work(db); });
    db.notification.findFirst.mockResolvedValue(record({ phaseAt: reservedAt }));
    await expect(actOnNotification("owner", "notification", { action: "keep" }))
      .resolves.toMatchObject({ ok: false, code: "CONFLICT" });
    expect(db.$queryRaw).toHaveBeenCalledOnce();
    expect(db.gift.updateMany).not.toHaveBeenCalled();
    expect(db.notification.updateMany).not.toHaveBeenCalled();
  });

  it("changes bought only for the holder of the same active notification phase", async function holderBoughtToggle() {
    db.$transaction.mockImplementation(async function run(work) { return work(db); });
    db.gift.updateMany.mockResolvedValue({ count: 1 });
    db.gift.findUnique.mockResolvedValue({ ...gift, reservationPhase: "AWAITING_GIVER" });
    db.notification.findFirst.mockResolvedValue(record({
      kind: "RESERVATION_DUE", recipientId: "holder", actorId: "owner",
    }));
    await expect(actOnNotification("holder", "notification", { action: "bought" })).resolves.toMatchObject({ ok: true });
    await expect(actOnNotification("holder", "notification", { action: "clearBought" })).resolves.toMatchObject({ ok: true });
    expect(db.gift.updateMany.mock.calls.map(([input]) => input.data)).toEqual([
      { reservationBought: true }, { reservationBought: false },
    ]);
    db.gift.findUnique.mockResolvedValue({ ...gift, reservationPhase: "AWAITING_GIVER", reservationPhaseAt: reservedAt });
    await expect(actOnNotification("holder", "notification", { action: "clearBought" }))
      .resolves.toMatchObject({ ok: false, code: "CONFLICT" });
    expect(db.gift.updateMany).toHaveBeenCalledTimes(2);
  });

  it("queues owner keep in-app only and renders the exclusive deadline in the reservation zone", async function ownerKeep() {
    await enqueueGiftNotification(db as never, await notificationGiftSnapshot(db as never, gift.id), {
      kind: "RESERVATION_KEPT_BY_OWNER", role: "holder", at: now, email: false,
    });
    const { data } = db.notification.createMany.mock.calls[0]![0];
    expect(data.emailRequired).toBe(false);
    const item = await projectNotification(record(data), defaults, "inApp", now);
    expect(item && notificationText(item.event, "ru")).toBe("Владелец продлил вашу бронь «Снимок названия» до 25 ноября");
  });

  it("keeps in-app and email preference predicates independent", async function channels() {
    const row = record({ kind: "DATE_OWN", giftId: null, actorId: null, payload: {} });
    await expect(projectNotification(row, { ...defaults, datesInApp: false }, "inApp", now)).resolves.toBeNull();
    await expect(projectNotification(row, { ...defaults, datesInApp: false }, "email", now)).resolves.toMatchObject({ event: { kind: "DATE_OWN" } });
    await expect(projectNotification(row, { ...defaults, datesEmail: false }, "inApp", now)).resolves.toMatchObject({ event: { kind: "DATE_OWN" } });
    await expect(projectNotification(row, { ...defaults, datesEmail: false }, "email", now)).resolves.toBeNull();
  });

  it("hides closure from both channels until the undo window and cancels that event atomically", async function deferredClose() {
    await enqueueGiftNotification(db as never, await notificationGiftSnapshot(db as never, gift.id), {
      kind: "GIFT_CLOSED", role: "holder", at: now, email: true,
    });
    const { data, skipDuplicates } = db.notification.createMany.mock.calls[0]![0];
    expect(skipDuplicates).toBe(true);
    expect(data.deliverAfter).toEqual(new Date("2026-11-24T12:10:00Z"));
    const row = record(data);
    const before = new Date("2026-11-24T12:09:59.999Z");
    await expect(projectNotification(row, defaults, "inApp", before)).resolves.toBeNull();
    await expect(projectNotification(row, defaults, "email", before)).resolves.toBeNull();
    await cancelCloseNotification(db as never, gift.id, now);
    expect(db.notification.deleteMany).toHaveBeenCalledWith({ where: { eventKey: data.eventKey } });
  });

  it("updates unread state only for the recipient's ready event", async function markRead() {
    db.notification.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(record());
    await expect(markNotificationRead("other", "notification")).resolves.toBe(false);
    expect(db.notification.updateMany).not.toHaveBeenCalled();
    await expect(markNotificationRead("owner", "notification")).resolves.toBe(true);
    expect(db.notification.updateMany).toHaveBeenCalledWith({
      where: { id: "notification", recipientId: "owner", readAt: null }, data: { readAt: expect.any(Date) },
    });
  });

  it("counts visible unread in bounded windows and never counts again for a feed page", async function unreadWindows() {
    const initial = Array.from({ length: 30 }, function known(_, index) {
      return record({ id: String(index), kind: "DATE_OWN", giftId: null });
    });
    const hidden = record({ id: "hidden", kind: "DATE_FRIEND", giftId: null });
    db.notification.findMany.mockResolvedValueOnce(initial).mockResolvedValueOnce([hidden]);
    await expect(countUnreadNotifications("owner")).resolves.toBe(30);
    expect(db.notification.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      take: 30, where: expect.objectContaining({ recipientId: "owner", readAt: null }),
    }));
    expect(db.notification.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      take: 30, where: expect.objectContaining({ OR: expect.any(Array) }),
    }));

    db.notification.findMany.mockClear().mockResolvedValueOnce([]);
    db.notification.findFirst.mockResolvedValueOnce(initial[29]);
    await expect(readNotifications("owner", "29")).resolves.toEqual({ items: [], nextCursor: null });
    expect(db.notification.findMany).toHaveBeenCalledOnce();
    expect(db.notification.findMany.mock.calls[0]![0].where).not.toHaveProperty("readAt");
  });

  it("uses a generic fallback for an unrecognized notification", async function fallback() {
    const row = record({ kind: "NEW_KIND" as Notification["kind"], giftId: null, payload: { hidden: "value" } });
    await expect(projectNotification(row, defaults, "inApp", now))
      .resolves.toMatchObject({ event: { kind: "UNKNOWN" } });
  });
});

describe("email notification queue", function mailTests() {
  it("keeps the notification id on the existing return path through sign-in", function link() {
    const href = new URL(notificationEmailLink("http://example.test", "example"));
    expect(href.protocol).toBe("https:");
    expect(safeNextPath(href.pathname + href.search)).toBe("/notifications?id=example");
  });

  it.each([null, new Date(now.getTime() - 60_000)])(
    "lets only one worker claim the same pending attempt (%s)",
    async function concurrentClaim(firstAttemptAt) {
      const row = record({
        emailFirstAttemptAt: firstAttemptAt,
        payload: { role: "owner", titleSnapshot: gift.title, holderName: gift.reservedBy.name },
      });
      const rows = mockEmailQueue([row]);
      const send = vi.fn<NonNullable<Parameters<typeof processNotificationEmails>[1]>>().mockResolvedValue("sent");
      await Promise.all([
        processNotificationEmails(now, send, "https://example.test"),
        processNotificationEmails(now, send, "https://example.test"),
      ]);
      expect(send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
        to: "owner@example.test",
        text: expect.stringContaining("https://example.test/notifications?id=notification"),
      }), "notification/notification");
      if (firstAttemptAt) expect(rows[0]?.emailFirstAttemptAt).toEqual(firstAttemptAt);
      const body = send.mock.calls[0]![0].text;
      expect(body.split("\n")[0]).toBe("Срок брони «Текущее название» истёк, даритель пока не ответил. Подарок уже у вас?");
      expect(body).not.toContain(gift.reservedBy.name);
      expect(body).not.toContain(gift.reservationDueAt.toISOString());
    },
  );

  it("orders retries and new attempts by delivery time and gives edited and stale events localized copy", async function mailCopy() {
    const edited = record({
      id: "edited", recipientId: "holder", actorId: "owner", kind: "GIFT_EDITED",
      deliverAfter: new Date(now.getTime() - 1),
      emailFirstAttemptAt: new Date(now.getTime() - 60_000),
      payload: { role: "holder", titleSnapshot: gift.titleSnapshotOnReserve, fields: ["title", "price"] },
    });
    const stale = record({ id: "stale", phaseAt: reservedAt });
    mockEmailQueue([stale, edited]);
    const send = vi.fn<NonNullable<Parameters<typeof processNotificationEmails>[1]>>().mockResolvedValue("sent");
    await processNotificationEmails(now, send, "https://example.test");
    expect(send.mock.calls.map(call => call[1])).toEqual(["notification/edited", "notification/stale"]);
    expect(send.mock.calls[0]![0].text).toContain("Изменилось: название, цена");
    expect(send.mock.calls[0]![0].html).toContain("<p>Изменилось: название, цена</p>");
    expect(send.mock.calls[1]![0].text.split("\n")[0]).toBe("Даритель уже ответил");
    expect(send.mock.calls[1]![0].html).toContain("<p>Даритель уже ответил</p>");
    expect(send.mock.calls[1]![0].text).not.toContain("пока не ответил");
    expect(db.notification.findMany.mock.calls[1]![0].orderBy).toEqual([{ deliverAfter: "asc" }, { id: "asc" }]);
  });

  it("retires expired attempts and reports them once across competing workers", async function expiredAttempts() {
    const expiredAt = new Date(now.getTime() - 23 * 60 * 60_000);
    const rows = mockEmailQueue([record({ emailFirstAttemptAt: expiredAt })]);
    const send = vi.fn<NonNullable<Parameters<typeof processNotificationEmails>[1]>>();
    const log = vi.spyOn(console, "error").mockImplementation(function quiet() {});
    try {
      const results = await Promise.all([
        processNotificationEmails(now, send, "https://example.test"),
        processNotificationEmails(now, send, "https://example.test"),
      ]);
      expect(results.map(result => result.expired).sort()).toEqual([0, 1]);
      expect(rows[0]?.emailDoneAt).toEqual(now);
      expect(send).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalledExactlyOnceWith("notification-email: retry window expired", { count: 1 });
    } finally {
      log.mockRestore();
    }
  });

  it.each([null, { status: "CLOSED", closedAt: reservedAt }])(
    "claims mail under the Gift lock and sends outside it (%s)",
    async function deferredClaim(giftState) {
      const row = record({
        kind: "GIFT_CLOSED", recipientId: "holder", actorId: "owner", createdAt: reservedAt,
        payload: { role: "holder", titleSnapshot: gift.titleSnapshotOnReserve },
      });
      mockEmailQueue([row]);
      db.gift.findUnique.mockResolvedValue(giftState ? { ...gift, ...giftState } : null);
      db.$queryRaw.mockResolvedValueOnce(giftState ? [giftState] : []).mockResolvedValueOnce([{ now }]);
      let holdingLock = false;
      db.$transaction.mockImplementation(async function transaction(work) {
        holdingLock = true;
        try { return await work(db); }
        finally { holdingLock = false; }
      });
      const send = vi.fn(async function sendOutsideTransaction() {
        expect(holdingLock).toBe(false);
        return "sent" as const;
      });
      await expect(processNotificationEmails(now, send, "https://example.test"))
        .resolves.toMatchObject({ sent: 1 });
      expect(db.$queryRaw.mock.calls[0]![0].join("")).toContain("FOR UPDATE");
      expect(db.$queryRaw.mock.invocationCallOrder[1]).toBeLessThan(db.notification.updateMany.mock.invocationCallOrder[0]!);
      expect(send).toHaveBeenCalledOnce();
    },
  );

  it("does not claim a closure cancelled while the worker waited for the Gift lock", async function cancelledClosure() {
    const rows = mockEmailQueue([record({ kind: "GIFT_CLOSED", createdAt: reservedAt })]);
    db.$transaction.mockImplementation(async function transaction(work) { return work(db); });
    db.$queryRaw.mockImplementationOnce(async function waitForUndo() {
      rows.length = 0;
      return [{ status: "RESERVED", closedAt: null }];
    }).mockResolvedValueOnce([{ now }]);
    const send = vi.fn<NonNullable<Parameters<typeof processNotificationEmails>[1]>>();
    await expect(processNotificationEmails(now, send, "https://example.test"))
      .resolves.toMatchObject({ sent: 0 });
    expect(db.notification.updateMany).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("rechecks due time after acquiring the Gift lock", async function dueAfterLock() {
    mockEmailQueue([record({ kind: "GIFT_CLOSED", createdAt: reservedAt })]);
    db.$transaction.mockImplementation(async function transaction(work) { return work(db); });
    db.$queryRaw.mockResolvedValueOnce([{ status: "CLOSED", closedAt: reservedAt }])
      .mockResolvedValueOnce([{ now: new Date(now.getTime() - 1) }]);
    const send = vi.fn<NonNullable<Parameters<typeof processNotificationEmails>[1]>>();
    await expect(processNotificationEmails(now, send, "https://example.test"))
      .resolves.toMatchObject({ sent: 0 });
    expect(send).not.toHaveBeenCalled();
  });
});

type QueueFilter = {
  id?: string | { in: string[] };
  emailRequired?: boolean;
  emailDoneAt?: null;
  deliverAfter?: { lte: Date };
  emailLeaseUntil?: Date | null | { lte: Date };
  emailFirstAttemptAt?: Date | null | { lte?: Date; gt?: Date };
  AND?: QueueFilter[];
  OR?: QueueFilter[];
};

function matchesDate(value: Date | null, filter: Date | null | { lte?: Date; gt?: Date } | undefined): boolean {
  if (filter === undefined) return true;
  if (filter === null) return value === null;
  if (value === null) return false;
  if (filter instanceof Date) return value.getTime() === filter.getTime();
  return (!filter.lte || value <= filter.lte) && (!filter.gt || value > filter.gt);
}

function matchesQueueFilter(row: Notification, where: QueueFilter): boolean {
  if (where.AND && !where.AND.every(rule => matchesQueueFilter(row, rule))) return false;
  if (where.OR && !where.OR.some(rule => matchesQueueFilter(row, rule))) return false;
  if (typeof where.id === "string" && where.id !== row.id) return false;
  if (typeof where.id === "object" && !where.id.in.includes(row.id)) return false;
  if (where.emailRequired !== undefined && where.emailRequired !== row.emailRequired) return false;
  if (where.emailDoneAt === null && row.emailDoneAt !== null) return false;
  return matchesDate(row.deliverAfter, where.deliverAfter) &&
    matchesDate(row.emailLeaseUntil, where.emailLeaseUntil) &&
    matchesDate(row.emailFirstAttemptAt, where.emailFirstAttemptAt);
}

function mockEmailQueue(rows: Notification[]) {
  db.notification.findMany.mockImplementation(async function select(args: { where: QueueFilter; take: number }) {
    return rows.filter(row => matchesQueueFilter(row, args.where))
      .sort((left, right) => left.deliverAfter.getTime() - right.deliverAfter.getTime())
      .slice(0, args.take)
      .map(row => ({ ...row }));
  });
  db.notification.updateMany.mockImplementation(async function atomicUpdate(args: {
    where: QueueFilter; data: Partial<Notification>;
  }) {
    const matched = rows.filter(row => matchesQueueFilter(row, args.where));
    for (const row of matched) Object.assign(row, args.data);
    return { count: matched.length };
  });
  db.notification.findUnique.mockImplementation(async function select(args: { where: QueueFilter }) {
    const row = rows.find(candidate => matchesQueueFilter(candidate, args.where));
    return row ? { ...row, recipient: { ...defaults, email: "owner@example.test", locale: "ru" } } : null;
  });
  return rows;
}
