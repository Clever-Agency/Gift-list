import { describe, expect, it } from "vitest";
import {
  RESERVATION_RELEASE_AFTER_MS,
  notificationActionSchema,
  notificationItemSchema,
  notificationPayloadSchema,
  notificationPreferencesPatchSchema,
  notificationPreferencesSchema,
} from "./notifications";
import { notificationDetails, notificationEmailSubject, notificationText } from "./i18n/notification-text";
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

describe("CLE-137: reminder preferences carry both type switches", () => {
  const prefs = {
    datesInApp: true, datesEmail: true, wishExpiryInApp: true, wishExpiryEmail: true,
    remindFriendDates: true, remindOwnList: false,
  };

  it("reads both type switches together with the channels", () => {
    expect(notificationPreferencesSchema.parse(prefs)).toEqual(prefs);
    expect(notificationPreferencesSchema.safeParse({
      ...prefs, remindFriendDates: "yes",
    }).success).toBe(false);
  });

  it("changes either type switch alone and rejects an unknown key", () => {
    expect(notificationPreferencesPatchSchema.parse({ remindFriendDates: false })).toEqual({ remindFriendDates: false });
    expect(notificationPreferencesPatchSchema.parse({ remindOwnList: true })).toEqual({ remindOwnList: true });
    expect(notificationPreferencesPatchSchema.safeParse({ remindOwnList: 1 }).success).toBe(false);
    expect(notificationPreferencesPatchSchema.safeParse({ remindWeekly: true }).success).toBe(false);
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

  it("gives each wish-expiry kind its own letter subject and a date reminder its own", () => {
    expect(notificationEmailSubject(soon, "ru")).toBe("Срок желания истекает через 3 дня — {brand}");
    expect(notificationEmailSubject(released, "ru")).toBe("Срок желания вышел — {brand}");
    expect(notificationEmailSubject({ kind: "DATE_OWN" }, "ru"))
      .toBe("Скоро ваш день рождения — обновите вишлист — {brand}");
  });
});

/**
 * Story 7.3 (FR-34, AD-27): a Friend's birthday is named without its year, the
 * summary counts open wishes and names up to three of them. A row written before
 * the summary existed still renders its first line.
 */
describe("Story 7.3: friend birthday copy", () => {
  const friend = {
    kind: "DATE_FRIEND",
    personName: "Аня",
    personNick: "anya",
    date: "2026-03-14",
    count: 4,
    titles: ["Плед", "Книга", "Наушники"],
  } satisfies NotificationItem["event"];

  it("names the day without a year and keeps the calendar day", () => {
    expect(notificationText(friend, "ru")).toBe("У Аня день рождения 14.03");
  });

  it("adds the open-wish count and up to three titles", () => {
    expect(notificationDetails(friend, "ru")).toEqual([
      "Открытых желаний: 4",
      "«Плед», «Книга», «Наушники»",
    ]);
    expect(notificationDetails({ ...friend, titles: ["Плед", "Книга", "Наушники", "Худи"] }, "ru")[1])
      .toBe("«Плед», «Книга», «Наушники»");
    expect(notificationDetails({ ...friend, titles: [] }, "ru")).toEqual(["Открытых желаний: 4"]);
  });

  it("renders a row without the summary and names the letter subject", () => {
    const legacy = {
      kind: "DATE_FRIEND",
      personName: "Аня",
      personNick: "anya",
      date: "2026-03-14",
    } satisfies NotificationItem["event"];

    expect(notificationText(legacy, "ru")).toBe("У Аня день рождения 14.03");
    expect(notificationDetails(legacy, "ru")).toEqual([]);
    expect(notificationEmailSubject(friend, "ru")).toBe("У Аня день рождения 14.03 — {brand}");
  });

  it("parses only the birthday keys and drops a holder or a status", () => {
    const parsed = notificationPayloadSchema.parse({
      ...friend,
      holderName: "Даниэль",
      status: "RESERVED",
      reservationPhase: "ACTIVE",
    });
    expect(parsed).toEqual(friend);
    expect(JSON.stringify(parsed)).not.toContain("Даниэль");
    expect(JSON.stringify(parsed)).not.toContain("RESERVED");
  });
});

/**
 * Story 7.4 (FR-35, AD-27): the owner's own reminder asks to update the
 * wishlist. The text is shared by the feed and the first letter line; the
 * subject names the same action.
 */
describe("Story 7.4: own birthday reminder copy", () => {
  const own = { kind: "DATE_OWN" } satisfies NotificationItem["event"];

  it("asks the owner to update the wishlist in the feed and in the letter", () => {
    expect(notificationText(own, "ru")).toBe("Скоро ваш день рождения — обновите вишлист");
    expect(notificationEmailSubject(own, "ru")).toBe("Скоро ваш день рождения — обновите вишлист — {brand}");
    expect(notificationDetails(own, "ru")).toEqual([]);
  });
});
