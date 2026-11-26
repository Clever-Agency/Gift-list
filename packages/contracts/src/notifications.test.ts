import { describe, expect, it } from "vitest";
import {
  RESERVATION_RELEASE_AFTER_MS,
  notificationActionSchema,
  notificationItemSchema,
  notificationPayloadSchema,
} from "./notifications";
import { notificationEmailSubject, notificationText } from "./i18n/notification-text";
import type { NotificationItem } from "./notifications";

describe("CLE-124/S9b-2: notification payloads", () => {
  it("keeps GIFT_GIVEN a bare kind, so no title or holder can travel", () => {
    expect(notificationPayloadSchema.parse({ kind: "GIFT_GIVEN" })).toEqual({ kind: "GIFT_GIVEN" });

    // A legacy row may still carry the old keys; the schema strips them.
    expect(
      notificationPayloadSchema.parse({
        kind: "GIFT_GIVEN",
        giftId: "g1",
        titleSnapshot: "Плед",
        holderName: "Дарья",
        actionable: true,
      }),
    ).toEqual({ kind: "GIFT_GIVEN" });
  });

  it("keeps the deadline and the reminder flag on RESERVATION_DUE", () => {
    const payload = notificationPayloadSchema.parse({
      kind: "RESERVATION_DUE",
      giftId: "g1",
      titleSnapshot: "Плед",
      actionable: true,
      bought: false,
      dueAt: "2026-11-25T21:00:00.000Z",
      timeZone: "Europe/Minsk",
      reminder: true,
    });

    expect(payload).toMatchObject({
      dueAt: "2026-11-25T21:00:00.000Z",
      timeZone: "Europe/Minsk",
      reminder: true,
    });
  });

  it("accepts a legacy RESERVATION_DUE payload without the date keys", () => {
    const payload = notificationPayloadSchema.parse({
      kind: "RESERVATION_DUE",
      giftId: "g1",
      titleSnapshot: "Плед",
      actionable: true,
    });
    expect(payload).not.toHaveProperty("dueAt");
    expect(payload).not.toHaveProperty("reminder");
  });

  it("carries the release window the timer uses", () => {
    expect(RESERVATION_RELEASE_AFTER_MS).toBe(168 * 60 * 60 * 1000);
  });

  it("derives the release date from the deadline in the item schema", () => {
    const item = notificationItemSchema.parse({
      id: "n1",
      createdAt: "2026-11-24T12:00:00.000Z",
      readAt: null,
      href: null,
      event: {
        kind: "RESERVATION_DUE",
        giftId: "g1",
        titleSnapshot: "Плед",
        actionable: true,
        dueAt: "2026-11-25T21:00:00.000Z",
        timeZone: "Europe/Minsk",
      },
    });
    expect(item.event).toMatchObject({ dueAt: "2026-11-25T21:00:00.000Z" });
  });
});

describe("CLE-124/S9c: notification dates come from the one day formatter", () => {
  const due = {
    kind: "RESERVATION_DUE",
    giftId: "g1",
    titleSnapshot: "Плед",
    actionable: true,
    dueAt: "2026-11-25T21:00:00.000Z",
    timeZone: "Europe/Minsk",
  } satisfies NotificationItem["event"];

  it("names the deadline day and the release day in words, in the recipient's zone", () => {
    expect(notificationText({ ...due, reminder: true }, "ru")).toBe(
      "Срок брони «Плед» — 25 ноября. Продлите или отметьте «Купил»; если не продлить, бронь снимется через 7 дней после этой даты",
    );
    expect(notificationText(due, "ru")).toBe(
      "Срок брони «Плед» истёк. Если ничего не сделать, бронь снимется 3 декабря",
    );
  });

  it("names the kept day in words, in the recipient's zone", () => {
    const kept = {
      kind: "RESERVATION_KEPT_BY_OWNER",
      giftId: "g1",
      titleSnapshot: "Плед",
      dueAt: "2026-11-25T21:00:00.000Z",
      timeZone: "Europe/Minsk",
    } satisfies NotificationItem["event"];

    expect(notificationText(kept, "ru")).toBe("Владелец продлил вашу бронь «Плед» до 25 ноября");
  });
});

describe("CLE-124/S9b-2: notification actions", () => {
  it("accepts «Подарил» with no extra field", () => {
    expect(notificationActionSchema.parse({ action: "given" })).toEqual({ action: "given" });
    expect(notificationActionSchema.safeParse({ action: "given", value: true }).success).toBe(true);
    expect(notificationActionSchema.safeParse({ action: "given", dueOn: "2026-11-30" }).success).toBe(true);
  });
});

describe("Story 6.6: the wish-expiry payload", () => {
  it("carries the released variant of WISH_EXPIRY", () => {
    expect(notificationPayloadSchema.parse({
      kind: "WISH_EXPIRY",
      giftId: "g1",
      titleSnapshot: "Плед",
      released: true,
    })).toMatchObject({ released: true });
    expect(notificationPayloadSchema.parse({
      kind: "WISH_EXPIRY",
      giftId: "g1",
      titleSnapshot: "Плед",
      released: false,
    })).toMatchObject({ released: false });
  });

  it("accepts a legacy WISH_EXPIRY row without the flag", () => {
    const payload = notificationPayloadSchema.parse({
      kind: "WISH_EXPIRY",
      giftId: "g1",
      titleSnapshot: "Плед",
    });
    expect(payload).not.toHaveProperty("released");
  });

  it("rejects a non-boolean flag and keeps the soon notice unchanged", () => {
    expect(notificationPayloadSchema.safeParse({
      kind: "WISH_EXPIRY",
      giftId: "g1",
      titleSnapshot: "Плед",
      released: "yes",
    }).success).toBe(false);
    expect(notificationPayloadSchema.parse({
      kind: "WISH_EXPIRY_SOON",
      giftId: "g1",
      titleSnapshot: "Плед",
    })).toEqual({ kind: "WISH_EXPIRY_SOON", giftId: "g1", titleSnapshot: "Плед" });
  });

  it("carries the projection-computed actionable flag on WISH_EXPIRY only", () => {
    expect(notificationPayloadSchema.parse({
      kind: "WISH_EXPIRY",
      giftId: "g1",
      titleSnapshot: "Плед",
      released: false,
      actionable: true,
    })).toMatchObject({ released: false, actionable: true });

    // The soon notice has no action; a stray flag never reaches the client.
    expect(notificationPayloadSchema.parse({
      kind: "WISH_EXPIRY_SOON",
      giftId: "g1",
      titleSnapshot: "Плед",
      actionable: true,
    })).not.toHaveProperty("actionable");
  });
});

describe("Story 6.6: wish-expiry copy", () => {
  const soon = {
    kind: "WISH_EXPIRY_SOON",
    giftId: "g1",
    titleSnapshot: "Плед",
  } satisfies NotificationItem["event"];
  const released = {
    kind: "WISH_EXPIRY",
    giftId: "g1",
    titleSnapshot: "Плед",
  } satisfies NotificationItem["event"];

  it("names the soon notice and both expiry variants", () => {
    expect(notificationText(soon, "ru")).toBe("Срок желания «Плед» через 3 дня");
    expect(notificationText(released, "ru")).toBe("Срок желания «Плед» вышел, бронь снята");
    expect(notificationText({ ...released, released: true }, "ru")).toBe(
      "Срок желания «Плед» вышел, бронь снята",
    );
    expect(notificationText({ ...released, released: false }, "ru")).toBe(
      "Срок желания «Плед» вышел. Если уже подарили — отметьте «Подарил»",
    );
  });

  it("gives each wish-expiry kind its own letter subject and keeps the general one", () => {
    expect(notificationEmailSubject(soon, "ru")).toBe("Срок желания истекает через 3 дня — {brand}");
    expect(notificationEmailSubject(released, "ru")).toBe("Срок желания вышел — {brand}");
    expect(notificationEmailSubject({ kind: "DATE_OWN" }, "ru")).toBe("Новое уведомление — {brand}");
  });
});
