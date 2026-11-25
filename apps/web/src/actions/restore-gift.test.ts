import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, userFindUnique, giftFindFirst, restoreFromArchive } = vi.hoisted(() => ({
  getSession: vi.fn(),
  userFindUnique: vi.fn(),
  giftFindFirst: vi.fn(),
  restoreFromArchive: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({
  prisma: {
    user: { findUnique: userFindUnique },
    gift: { findFirst: giftFindFirst },
  },
}));
vi.mock("@/lib/gift-status-store", () => ({
  restoreFromArchive,
}));

import { restoreGift } from "./restore-gift";

const headers = new Headers();

function giftRow() {
  return {
    id: "g1",
    title: "Книга",
    description: null,
    priceAmount: null,
    priceCurrency: null,
    linkUrl: null,
    visibility: "PUBLIC" as const,
    quantity: "SINGLE" as const,
    expiresOn: new Date("2026-12-31T00:00:00.000Z"),
    archivedAt: null,
    status: "OPEN" as const,
    reservationPhase: null,
    holderVisibleToOwner: false,
    reservedBy: null,
    tags: [],
    list: { ownerId: "u1" },
  };
}

beforeEach(() => {
  getSession.mockReset();
  userFindUnique.mockReset();
  giftFindFirst.mockReset();
  restoreFromArchive.mockReset();
  getSession.mockResolvedValue({ user: { id: "u1" }, session: { token: "t" } });
  userFindUnique.mockResolvedValue({ timeZone: "UTC" });
  restoreFromArchive.mockResolvedValue("ok");
  giftFindFirst.mockResolvedValue(giftRow());
});

describe("restoreGift", () => {
  it("requires a session and does not touch the service", async () => {
    getSession.mockResolvedValue(null);

    expect(await restoreGift(headers, "g1", { expiresOn: null })).toMatchObject({
      ok: false,
      code: "UNAUTHENTICATED",
    });
    expect(restoreFromArchive).not.toHaveBeenCalled();
    expect(giftFindFirst).not.toHaveBeenCalled();
  });

  it("returns VALIDATION on a past day and does not write", async () => {
    restoreFromArchive.mockResolvedValue("past");

    expect(await restoreGift(headers, "g1", { expiresOn: "2026-11-09" })).toMatchObject({
      ok: false,
      code: "VALIDATION",
      field: "expiresOn",
    });
    expect(restoreFromArchive).toHaveBeenCalledWith({
      giftId: "g1",
      ownerId: "u1",
      expiresOn: "2026-11-09",
      timeZone: "UTC",
    });
    expect(giftFindFirst).not.toHaveBeenCalled();
  });

  it("answers NOT_FOUND for a foreign or non-archived wish", async () => {
    restoreFromArchive.mockResolvedValue("missing");

    expect(await restoreGift(headers, "g1", { expiresOn: null })).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
    expect(giftFindFirst).not.toHaveBeenCalled();
  });

  it("returns the restored card after a successful write", async () => {
    const result = await restoreGift(headers, "g1", { expiresOn: "2026-12-31" });

    expect(restoreFromArchive).toHaveBeenCalledWith({
      giftId: "g1",
      ownerId: "u1",
      expiresOn: "2026-12-31",
      timeZone: "UTC",
    });
    expect(result).toMatchObject({
      ok: true,
      data: { id: "g1", title: "Книга", expiresOn: "2026-12-31", archivedAt: null, status: "OPEN" },
    });
  });

  /** D-49: a restored wish that is still held reads as an open one to its owner. */
  it("returns a restored reserved wish without any reservation sign", async () => {
    giftFindFirst.mockResolvedValue({
      ...giftRow(),
      status: "RESERVED",
      reservationPhase: "ACTIVE",
      holderVisibleToOwner: true,
      reservedBy: { id: "u2", nick: "anna", name: "Анна" },
    });

    const result = await restoreGift(headers, "g1", { expiresOn: null });

    expect(result).toMatchObject({
      ok: true,
      data: { id: "g1", status: "OPEN", reservedBy: null, ownerAction: null },
    });
    expect(JSON.stringify(result)).not.toContain("Анна");
  });

  it("passes a cleared date through to the service", async () => {
    giftFindFirst.mockResolvedValue({ ...giftRow(), expiresOn: null });

    const result = await restoreGift(headers, "g1", { expiresOn: null });

    expect(restoreFromArchive).toHaveBeenCalledWith({
      giftId: "g1",
      ownerId: "u1",
      expiresOn: null,
      timeZone: "UTC",
    });
    expect(result).toMatchObject({ ok: true, data: { id: "g1", expiresOn: null } });
  });
});
