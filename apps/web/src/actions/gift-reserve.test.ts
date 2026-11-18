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

import { reserveGift as reserveGiftAction } from "./gift-reserve";

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
  list: { ownerId: "owner" },
};

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ user: { id: "donor" } });
  userFindUnique.mockResolvedValue({ timeZone: "UTC" });
  relationsBetween.mockResolvedValue({
    blocked: false,
    friend: false,
    subscriber: false,
    contactMatch: false,
  });
});

describe("reserveGift", () => {
  it("answers FORBIDDEN when the viewer owns the wish", async () => {
    getSession.mockResolvedValue({ user: { id: "owner" } });
    findFirst.mockResolvedValue(baseRow);

    const result = await reserveGiftAction(headers, "g1", {
      dueOn: "2026-12-01",
      holderVisibleToOwner: false,
      holderVisibleToOthers: true,
    });

    expect(result).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });

  it("answers VALIDATION for UNLIMITED before CAS", async () => {
    findFirst.mockResolvedValue({ ...baseRow, quantity: "UNLIMITED" });

    const result = await reserveGiftAction(headers, "g1", {
      dueOn: "2026-12-01",
      holderVisibleToOwner: false,
      holderVisibleToOthers: true,
    });

    expect(result).toMatchObject({ ok: false, code: "VALIDATION" });
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

    const result = await reserveGiftAction(headers, "g1", {
      dueOn: "2030-06-15",
      holderVisibleToOwner: false,
      holderVisibleToOthers: true,
    });

    expect(result).toMatchObject({
      ok: false,
      code: "CONFLICT",
      reason: "RESERVATION_TAKEN",
    });
  });
});