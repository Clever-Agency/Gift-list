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
  readNotification,
  enqueueGiftGivenNotice,
  enqueueGiftNotification,
  isHiddenOwnerReservationNotification,
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
  it("sends the owner one general given letter with no title, holder or action, and no in-app row", async function generalGiven() {
    db.gift.findUnique.mockResolvedValue({ ...gift, reservationPhase: "GIVEN" });
    // The row the store writes for «Подарил»: no gift id, no payload details.
    const row = record({
      kind: "GIFT_GIVEN",
      giftId: null,
      actorId: null,
      reservationAt: null,
      phaseAt: null,
      payload: {},
    });

    // Story 5.7: in-app GIFT_GIVEN does not exist; the letter is e-mail only.
    await expect(projectNotification(row, defaults, "inApp", now)).resolves.toBeNull();
    const item = await projectNotification(row, defaults, "email", now);
    expect(item?.event).toEqual({ kind: "GIFT_GIVEN" });
    expect(item?.href).toBeNull();
    expect(notificationText(item!.event, "ru")).toBe(
      "Проверьте свои желания — может, что-то пора обновить, добавить или убрать в архив",
    );
    expect(JSON.stringify(item)).not.toContain("Плед");
    expect(JSON.stringify(item)).not.toContain("Скрытый даритель");
    expect(JSON.stringify(item)).not.toContain("actionable");

    // CLE-124/D-49: even a legacy row with the old `true` flag never names the holder.
    db.gift.findUnique.mockResolvedValue({ ...gift, reservationPhase: "GIVEN", holderVisibleToOwner: true });
    const legacy = record({
      kind: "GIFT_GIVEN",
      payload: { role: "owner", titleSnapshot: gift.title, holderName: gift.reservedBy.name },
    });
    await expect(projectNotification(legacy, defaults, "inApp", now)).resolves.toBeNull();
    const legacyMail = await projectNotification(legacy, defaults, "email", now);
    expect(legacyMail?.event).not.toHaveProperty("holderName");
    expect(JSON.stringify(legacyMail)).not.toContain(gift.reservedBy.name);
    expect(JSON.stringify(legacyMail)).not.toContain(gift.title);
  });

  it("names the release date in the expiry notice and the deadline in the reminder", async function dueDates() {
    const dueAt = "2026-11-25T21:00:00.000Z";
    const expiry = record({
      kind: "RESERVATION_DUE",
      recipientId: "holder",
      actorId: "owner",
      payload: { role: "holder", titleSnapshot: gift.titleSnapshotOnReserve, dueAt, timeZone: "Europe/Minsk" },
    });
    db.gift.findUnique.mockResolvedValue({ ...gift, reservationPhase: "AWAITING_GIVER" });
    const expired = await projectNotification(expiry, defaults, "inApp", now);
    expect(expired?.event).toMatchObject({ actionable: true, dueAt, timeZone: "Europe/Minsk" });
    expect(notificationText(expired!.event, "ru")).toBe(
      "Срок брони «Снимок названия» истёк. Если ничего не сделать, бронь снимется 3 декабря",
    );

    const reminder = record({
      kind: "RESERVATION_DUE",
      recipientId: "holder",
      actorId: "owner",
      payload: {
        role: "holder",
        titleSnapshot: gift.titleSnapshotOnReserve,
        dueAt,
        timeZone: "Europe/Minsk",
        reminder: true,
      },
    });
    db.gift.findUnique.mockResolvedValue({ ...gift, reservationPhase: "ACTIVE" });
    const before = await projectNotification(reminder, defaults, "inApp", now);
    expect(before?.event).toMatchObject({ actionable: true, reminder: true, dueAt });
    expect(notificationText(before!.event, "ru")).toBe(
      "Срок брони «Снимок названия» — 25 ноября. Продлите или отметьте «Купил»; если не продлить, бронь снимется через 7 дней после этой даты",
    );

    // The reminder stops being actionable once the phase leaves ACTIVE.
    db.gift.findUnique.mockResolvedValue({ ...gift, reservationPhase: "AWAITING_GIVER" });
    expect((await projectNotification(reminder, defaults, "inApp", now))?.event)
      .toMatchObject({ actionable: false });
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
    const active = live && { ...live, reservationPhase: "AWAITING_GIVER" as const };
    const due = record({ kind: "RESERVATION_DUE", recipientId: "holder", actorId: "owner" });
    expect(notificationIsActionable(due, active)).toBe(true);
    expect(notificationIsActionable({ ...due, phaseAt: reservedAt }, active)).toBe(false);
    expect(notificationIsActionable({ ...due, reservationAt: now }, active)).toBe(false);
    expect(notificationIsActionable(due, live)).toBe(false);
  });

  it("rejects a stale control before the GiftStatusService CAS", async function rejectStaleMutation() {
    db.$transaction.mockImplementation(async function run(work) { return work(db); });
    db.gift.findUnique.mockResolvedValue({ ...gift, reservationPhase: "AWAITING_GIVER" });
    db.notification.findFirst.mockResolvedValue(record({
      kind: "RESERVATION_DUE", recipientId: "holder", actorId: "owner", phaseAt: reservedAt,
    }));
    await expect(actOnNotification("holder", "notification", { action: "bought" }))
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
    const visible = record({ kind: "DATE_OWN", giftId: null, payload: {} });
    db.notification.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(visible);
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

/**
 * CLE-124/S9b-2 (Story 5.7): «Подарил» writes the owner a general letter and
 * never an in-app row.
 */
describe("CLE-124/S9b-2: the owner's general given letter", function givenLetter() {
  it("queues one e-mail-only row a day without a gift, an actor or any payload", async function queue() {
    await enqueueGiftGivenNotice(db as never, "owner", now);

    const { data, skipDuplicates } = db.notification.createMany.mock.calls[0]![0];
    expect(skipDuplicates).toBe(true);
    expect(data).toMatchObject({
      kind: "GIFT_GIVEN",
      recipientId: "owner",
      eventKey: "GIFT_GIVEN:2026-11-24",
      emailRequired: true,
      payload: {},
    });
    expect(data.giftId).toBeUndefined();
    expect(data.actorId).toBeUndefined();
    expect(data.reservationAt).toBeUndefined();
    expect(data.phaseAt).toBeUndefined();
  });

  it("shows the letter in the e-mail channel only and keeps the link addressable", async function channels() {
    await enqueueGiftGivenNotice(db as never, "owner", now);
    const { data } = db.notification.createMany.mock.calls[0]![0];
    const row = record({ ...data, giftId: null });

    await expect(projectNotification(row, defaults, "inApp", now)).resolves.toBeNull();
    db.notification.findMany.mockResolvedValue([]);
    await expect(countUnreadNotifications("owner")).resolves.toBe(0);

    const mail = await projectNotification(row, defaults, "email", now);
    expect(mail?.event).toEqual({ kind: "GIFT_GIVEN" });
    db.notification.findFirst.mockResolvedValue(row);
    await expect(readNotification("owner", row.id)).resolves.toMatchObject({
      event: { kind: "GIFT_GIVEN" },
    });
  });
});

/**
 * CLE-124: a wish's reservation is a surprise for its owner. Rows written
 * before the rule stay in the database and are hidden by one rule at read time.
 */
describe("CLE-124: owner reservation rows are hidden", function hiddenOwnerRows() {
  const hiddenOwnerRows = [
    { kind: "RESERVATION_CREATED" as const, payload: { role: "owner", titleSnapshot: gift.title } },
    { kind: "RESERVATION_OWNER_ASK" as const, payload: { role: "owner", titleSnapshot: gift.title } },
    { kind: "RESERVATION_RELEASED" as const, payload: { role: "owner", titleSnapshot: gift.title } },
    { kind: "RESERVATION_AUTO_RELEASE" as const, payload: { role: "owner", titleSnapshot: gift.title } },
  ];

  it.each(hiddenOwnerRows)("hides an owner's $kind row from every read path", async function hidden(fixture) {
    const row = record({ kind: fixture.kind, recipientId: "owner", payload: fixture.payload });
    expect(isHiddenOwnerReservationNotification(row)).toBe(true);
    await expect(projectNotification(row, defaults, "inApp", now)).resolves.toBeNull();
    await expect(projectNotification(row, defaults, "email", now)).resolves.toBeNull();

    db.notification.findFirst.mockResolvedValue(row);
    await expect(readNotification("owner", row.id)).resolves.toBeNull();
    await expect(markNotificationRead("owner", row.id)).resolves.toBe(false);
    expect(db.notification.updateMany).not.toHaveBeenCalled();

    db.notification.findMany.mockResolvedValue([row]);
    await expect(countUnreadNotifications("owner")).resolves.toBe(0);
    await expect(readNotifications("owner")).resolves.toEqual({ items: [], nextCursor: null });
  });

  it("skips the owner's email and marks the attempt done without deleting the row", async function noOwnerEmail() {
    const rows = mockEmailQueue([record({ payload: { role: "owner", titleSnapshot: gift.title } })]);
    const send = vi.fn<NonNullable<Parameters<typeof processNotificationEmails>[1]>>().mockResolvedValue("sent");

    await expect(processNotificationEmails(now, send, "https://example.test"))
      .resolves.toMatchObject({ sent: 0 });

    expect(send).not.toHaveBeenCalled();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.emailDoneAt).toEqual(expect.any(Date));
    expect(db.notification.deleteMany).not.toHaveBeenCalled();
  });

  it("drops a legacy holderName from the owner e-mail even with the old true flag", async function legacyName() {
    const row = record({
      kind: "GIFT_GIVEN",
      payload: {
        role: "owner",
        titleSnapshot: gift.title,
        holderName: gift.reservedBy.name,
      },
    });
    db.gift.findUnique.mockResolvedValue({ ...gift, reservationPhase: "GIVEN", holderVisibleToOwner: true });

    // The in-app feed never carries a given row, legacy or not.
    await expect(projectNotification(row, defaults, "inApp", now)).resolves.toBeNull();

    mockEmailQueue([row]);
    const send = vi.fn<NonNullable<Parameters<typeof processNotificationEmails>[1]>>().mockResolvedValue("sent");
    await expect(processNotificationEmails(now, send, "https://example.test")).resolves.toMatchObject({ sent: 1 });
    expect(send.mock.calls[0]![0].text).not.toContain(gift.reservedBy.name);
    expect(send.mock.calls[0]![0].html).not.toContain(gift.reservedBy.name);
    expect(send.mock.calls[0]![0].text).not.toContain(gift.title);
  });

  it("keeps the holder's release and auto-release rows visible", async function holderRowsStay() {
    for (const kind of ["RESERVATION_RELEASED", "RESERVATION_AUTO_RELEASE"] as const) {
      const row = record({
        kind,
        recipientId: "holder",
        actorId: "owner",
        payload: { role: "holder", titleSnapshot: gift.titleSnapshotOnReserve },
      });
      expect(isHiddenOwnerReservationNotification(row)).toBe(false);
      await expect(projectNotification(row, defaults, "inApp", now))
        .resolves.toMatchObject({ event: { kind, titleSnapshot: gift.titleSnapshotOnReserve } });
    }
  });

  it("answers NOT_FOUND to an action on an old owner ask and changes nothing", async function noOwnerAction() {
    db.$transaction.mockImplementation(async function run(work) { return work(db); });
    db.notification.findFirst.mockResolvedValue(record());

    await expect(actOnNotification("owner", "notification", { action: "release" }))
      .resolves.toMatchObject({ ok: false, code: "NOT_FOUND" });

    expect(db.$queryRaw).not.toHaveBeenCalled();
    expect(db.gift.updateMany).not.toHaveBeenCalled();
    expect(db.notification.updateMany).not.toHaveBeenCalled();
  });
});

/**
 * CLE-124/S9b-2: «Подарил» from a reservation notice, and the refusal of an
 * extension once the deadline has passed.
 */
describe("CLE-124/S9b-2: the holder's actions from a reservation notice", function dueActions() {
  it("marks the reservation as given and answers a repeated press with success", async function given() {
    db.$transaction.mockImplementation(async function run(work) { return work(db); });
    db.notification.findFirst.mockResolvedValue(record({
      kind: "RESERVATION_DUE", recipientId: "holder", actorId: "owner",
    }));
    db.gift.findUnique.mockResolvedValue({ ...gift, reservationPhase: "AWAITING_GIVER" });
    db.gift.updateMany.mockResolvedValue({ count: 1 });
    db.notification.createMany.mockResolvedValue({ count: 1 });

    await expect(actOnNotification("holder", "notification", { action: "given" }))
      .resolves.toMatchObject({ ok: true });
    expect(db.gift.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { reservationPhase: "GIVEN", reservationPhaseAt: expect.any(Date) },
    }));

    // The second press in GIVEN is a success and writes nothing again.
    db.gift.findUnique.mockResolvedValue({ ...gift, reservationPhase: "GIVEN" });
    db.gift.updateMany.mockClear();
    db.notification.createMany.mockClear();
    await expect(actOnNotification("holder", "notification", { action: "given" }))
      .resolves.toMatchObject({ ok: true });
    expect(db.gift.updateMany).not.toHaveBeenCalled();
    expect(db.notification.createMany).not.toHaveBeenCalled();
  });

  it("refuses an extension from the notice once the deadline has passed", async function expiredExtend() {
    db.$transaction.mockImplementation(async function run(work) { return work(db); });
    db.notification.findFirst.mockResolvedValue(record({
      kind: "RESERVATION_DUE", recipientId: "holder", actorId: "owner",
    }));
    db.gift.findUnique.mockResolvedValue({
      ...gift,
      reservationPhase: "AWAITING_GIVER",
      reservationDueAt: new Date("2026-11-20T00:00:00.000Z"),
    });

    await expect(actOnNotification("holder", "notification", { action: "extend", dueOn: "2026-11-25" }))
      .resolves.toMatchObject({ ok: false, code: "CONFLICT", reason: "RESERVATION_DUE_PASSED" });
    expect(db.gift.updateMany).not.toHaveBeenCalled();
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
        kind: "RESERVATION_RELEASED",
        recipientId: "holder",
        actorId: "owner",
        emailFirstAttemptAt: firstAttemptAt,
        payload: { role: "holder", titleSnapshot: gift.titleSnapshotOnReserve, holderName: gift.reservedBy.name },
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
      expect(body.split("\n")[0]).toBe("Бронь на «Снимок названия» снята");
      expect(body).not.toContain(gift.reservedBy.name);
      expect(body).not.toContain(gift.title);
    },
  );

  it("orders retries and new attempts by delivery time and gives edited and holder events localized copy", async function mailCopy() {
    const edited = record({
      id: "edited", recipientId: "holder", actorId: "owner", kind: "GIFT_EDITED",
      deliverAfter: new Date(now.getTime() - 1),
      emailFirstAttemptAt: new Date(now.getTime() - 60_000),
      payload: { role: "holder", titleSnapshot: gift.titleSnapshotOnReserve, fields: ["title", "price"] },
    });
    const due = record({
      id: "due", recipientId: "holder", actorId: "owner", kind: "RESERVATION_DUE",
      payload: { role: "holder", titleSnapshot: gift.titleSnapshotOnReserve },
    });
    mockEmailQueue([due, edited]);
    const send = vi.fn<NonNullable<Parameters<typeof processNotificationEmails>[1]>>().mockResolvedValue("sent");
    await processNotificationEmails(now, send, "https://example.test");
    expect(send.mock.calls.map(call => call[1])).toEqual(["notification/edited", "notification/due"]);
    expect(send.mock.calls[0]![0].text).toContain("Изменилось: название, цена");
    expect(send.mock.calls[0]![0].html).toContain("<p>Изменилось: название, цена</p>");
    expect(send.mock.calls[1]![0].text.split("\n")[0]).toBe("Срок брони «Снимок названия» истёк");
    expect(send.mock.calls[1]![0].html).toContain("<p>Срок брони «Снимок названия» истёк</p>");
    expect(db.notification.findMany.mock.calls[1]![0].orderBy).toEqual([{ deliverAfter: "asc" }, { id: "asc" }]);
  });

  it("retires expired attempts and reports them once across competing workers", async function expiredAttempts() {
    const expiredAt = new Date(now.getTime() - 23 * 60 * 60_000);
    const rows = mockEmailQueue([record({
      kind: "RESERVATION_DUE", recipientId: "holder", emailFirstAttemptAt: expiredAt,
    })]);
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
