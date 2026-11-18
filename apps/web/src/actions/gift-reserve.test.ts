import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, findFirst, transaction, relationsBetween, reserveGiftWrite, userFindUnique } =
  vi.hoisted(() => ({
    getSession: vi.fn(),
    findFirst: vi.fn(),
    transaction: vi.fn(),
    relationsBetween: vi.fn(),
    reserveGiftWrite: vi.fn(),
    userFindUnique: vi.fn(),
  }));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({
  prisma: {
    gift: { findFirst },
    user: { findUnique: userFindUnique },
    $transaction: transaction,
  },
}));
vi.mock("@/lib/relationships", () => ({
  relationshipReader: { relationsBetween },
}));
vi.mock("@/lib/gift-status-store", () => ({
  giftStatusTransaction: () => ({ reserveGift: reserveGiftWrite }),
}));

import { addCalendarDays, calendarDayInZone } from "@/domain/reservation-due";
import { reserveGift as reserveGiftAction } from "./gift-reserve";

function dueOnFromNow(days: number): string {
  return addCalendarDays(calendarDayInZone(new Date(), "UTC"), days);
}

const headers = new Headers();

const baseRow = {
  id: "g1",
  title: "Плед",
  description: null,
  priceAmount: null,
  priceCurrency: null,
  linkUrl: null,
  visibility: "PUBLIC" as const,
  quantity: "SINGLE" as const,
  expiresOn: null,
  archivedAt: null,
  status: "OPEN" as const,
  reservationPhase: null,
  reservationDueAt: null,
  reservationTimeZone: null,
  reservationBought: false,
  holderVisibleToOwner: false,
  holderVisibleToOthers: true,
  reservedBy: null,
  tags: [],
  list: { ownerId: "owner", publicToken: "list_token" },
};

const body = {
  dueOn: dueOnFromNow(7),
  holderVisibleToOwner: false,
  holderVisibleToOthers: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ user: { id: "donor" } });
  userFindUnique.mockResolvedValue({ timeZone: "UTC" });
  relationsBetween.mockResolvedValue({
    blocked: false,
    friend: true,
    subscriber: false,
    contactMatch: false,
  });
});

describe("reserveGift", () => {
  it("answers FORBIDDEN when the viewer owns the wish", async () => {
    getSession.mockResolvedValue({ user: { id: "owner" } });
    findFirst.mockResolvedValue(baseRow);

    const result = await reserveGiftAction(headers, "g1", body);

    expect(result).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(reserveGiftWrite).not.toHaveBeenCalled();
  });

  it("answers FORBIDDEN for the owner of an archived wish", async () => {
    getSession.mockResolvedValue({ user: { id: "owner" } });
    findFirst.mockResolvedValue({ ...baseRow, archivedAt: new Date() });

    const result = await reserveGiftAction(headers, "g1", body);

    expect(result).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });

  it("answers VALIDATION for UNLIMITED before CAS", async () => {
    findFirst.mockResolvedValue({ ...baseRow, quantity: "UNLIMITED" });

    const result = await reserveGiftAction(headers, "g1", body);

    expect(result).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(reserveGiftWrite).not.toHaveBeenCalled();
  });

  it("answers NOT_FOUND when a stranger cannot see a public wish", async () => {
    relationsBetween.mockResolvedValue({
      blocked: false,
      friend: false,
      subscriber: false,
      contactMatch: false,
    });
    findFirst.mockResolvedValue(baseRow);

    const result = await reserveGiftAction(headers, "g1", body);

    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(reserveGiftWrite).not.toHaveBeenCalled();
  });

  it("accepts the list token as the way a non-friend sees the wish", async () => {
    relationsBetween.mockResolvedValue({
      blocked: false,
      friend: false,
      subscriber: false,
      contactMatch: false,
    });
    findFirst
      .mockResolvedValueOnce(baseRow)
      .mockResolvedValueOnce({
        ...baseRow,
        status: "RESERVED",
        reservationPhase: "ACTIVE",
        reservationDueAt: new Date("2026-12-08T00:00:00.000Z"),
        reservationTimeZone: "UTC",
        reservedBy: { id: "donor", nick: "donor", name: "Donor" },
      });
    transaction.mockImplementation(async function run(fn) {
      return fn({});
    });
    reserveGiftWrite.mockResolvedValue("success");

    const result = await reserveGiftAction(headers, "g1", body, "list_token");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.reservation?.phase).toBe("ACTIVE");
      expect(result.data.reservedBy?.id).toBe("donor");
    }
    expect(reserveGiftWrite).toHaveBeenCalledOnce();
  });

  it("answers UNAUTHENTICATED before reading the wish", async () => {
    getSession.mockResolvedValue(null);

    const result = await reserveGiftAction(headers, "g1", body);

    expect(result).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("answers VALIDATION DUE_OUT_OF_RANGE and does not write", async () => {
    findFirst.mockResolvedValue(baseRow);

    const result = await reserveGiftAction(headers, "g1", { ...body, dueOn: "2000-01-01" });

    expect(result).toMatchObject({
      ok: false,
      code: "VALIDATION",
      reason: "DUE_OUT_OF_RANGE",
    });
    if (!result.ok) expect(result.params?.max).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
    expect(reserveGiftWrite).not.toHaveBeenCalled();
  });

  it("answers CONFLICT without RESERVATION_TAKEN when the wish is closed", async () => {
    findFirst.mockResolvedValue({ ...baseRow, status: "CLOSED" });

    const result = await reserveGiftAction(headers, "g1", body);

    expect(result).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(result).not.toHaveProperty("reason");
    expect(reserveGiftWrite).not.toHaveBeenCalled();
  });

  it("answers CONFLICT with RESERVATION_TAKEN when CAS loses", async () => {
    findFirst.mockResolvedValueOnce(baseRow).mockResolvedValueOnce({
      ...baseRow,
      status: "RESERVED",
      reservedBy: { id: "other", nick: "o", name: "Other" },
    });
    transaction.mockImplementation(async function run(fn) {
      return fn({});
    });
    reserveGiftWrite.mockResolvedValue("lost");

    const result = await reserveGiftAction(headers, "g1", body);

    expect(result).toMatchObject({
      ok: false,
      code: "CONFLICT",
      reason: "RESERVATION_TAKEN",
    });
  });

  it("answers NOT_FOUND when the row disappears during CAS", async () => {
    findFirst.mockResolvedValueOnce(baseRow).mockResolvedValueOnce(null);
    transaction.mockImplementation(async function run(fn) {
      return fn({});
    });
    reserveGiftWrite.mockResolvedValue("lost");

    const result = await reserveGiftAction(headers, "g1", body);

    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  it("returns the holder card when the same person already holds the wish", async () => {
    findFirst.mockResolvedValue({
      ...baseRow,
      status: "RESERVED",
      reservationPhase: "ACTIVE",
      reservationDueAt: new Date("2026-12-08T00:00:00.000Z"),
      reservationTimeZone: "UTC",
      reservedBy: { id: "donor", nick: "donor", name: "Donor" },
    });

    const result = await reserveGiftAction(headers, "g1", body);

    expect(result.ok).toBe(true);
    expect(reserveGiftWrite).not.toHaveBeenCalled();
  });
});