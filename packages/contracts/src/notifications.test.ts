import { describe, expect, it } from "vitest";
import {
  RESERVATION_RELEASE_AFTER_MS,
  notificationActionSchema,
  notificationItemSchema,
  notificationPayloadSchema,
} from "./notifications";

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

describe("CLE-124/S9b-2: notification actions", () => {
  it("accepts «Подарил» with no extra field", () => {
    expect(notificationActionSchema.parse({ action: "given" })).toEqual({ action: "given" });
    expect(notificationActionSchema.safeParse({ action: "given", value: true }).success).toBe(true);
    expect(notificationActionSchema.safeParse({ action: "given", dueOn: "2026-11-30" }).success).toBe(true);
  });
});
