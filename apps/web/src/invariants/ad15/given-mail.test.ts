// AD-15 (5): «Подарил» is a surprise for the wish's owner. The one letter they
// receive names no wish and no holder, carries no action and never enters the
// in-app feed. The canonical pieces stay in `lib/gift-status-store.test.ts`
// (the phase CAS) and `lib/notification-store.test.ts` (the projection); this
// scenario checks the letter as the owner actually receives it.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const db = vi.hoisted(function database() {
  return {
    notification: { createMany: vi.fn() },
    gift: { findUnique: vi.fn() },
    relationsBetween: vi.fn(),
  };
});

vi.mock("@/db/client", function client() { return { prisma: db }; });
vi.mock("@/lib/auth", function authModule() { return { auth: {} }; });
vi.mock("@/lib/relationships", function relations() { return { relationshipReader: db }; });

import { notificationText } from "@gift-list/contracts";
import {
  enqueueGiftGivenNotice,
  projectNotification,
} from "@/lib/notification-store";

const AT = new Date("2026-11-24T12:00:00.000Z");
const PREFS = {
  datesInApp: true, datesEmail: true, wishExpiryInApp: true, wishExpiryEmail: true,
  remindFriendDates: true, remindOwnList: true,
};

beforeEach(function reset() {
  vi.resetAllMocks();
});

describe("AD-15 (5) — письмо владельцу после «Подарил» без деталей", () => {
  async function ownerLetter() {
    await enqueueGiftGivenNotice(db as never, "owner", AT);
    const { data } = db.notification.createMany.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    return {
      ...data,
      id: "notification",
      recipientId: "owner",
      readAt: null,
      emailFirstAttemptAt: null,
      emailLeaseUntil: null,
      emailDoneAt: null,
    };
  }

  it("не содержит названия желания, дарителя и идентификаторов подарка", async function noDetails() {
    const row = await ownerLetter();

    expect(row).toMatchObject({ kind: "GIFT_GIVEN", recipientId: "owner", emailRequired: true, payload: {} });
    expect(row).not.toHaveProperty("giftId");
    expect(row).not.toHaveProperty("actorId");
    expect(JSON.stringify(row)).not.toContain("Плед");
    expect(JSON.stringify(row)).not.toContain("Дарья");
  });

  it("уходит только письмом и не появляется в приложении", async function emailOnly() {
    const row = await ownerLetter();

    await expect(projectNotification(row as never, PREFS, "inApp", AT)).resolves.toBeNull();
    const mail = await projectNotification(row as never, PREFS, "email", AT);
    expect(mail?.event).toEqual({ kind: "GIFT_GIVEN" });
    expect(mail?.href).toBeNull();
    expect(notificationText(mail!.event, "ru")).toBe(
      "Проверьте свои желания — может, что-то пора обновить, добавить или убрать в архив",
    );
    expect(JSON.stringify(mail)).not.toContain("actionable");
  });
});
