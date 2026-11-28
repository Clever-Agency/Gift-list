import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, findFirst, runStatusTransaction, close, undo } = vi.hoisted(() => ({
  getSession: vi.fn(),
  findFirst: vi.fn(),
  runStatusTransaction: vi.fn(),
  close: vi.fn(),
  undo: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({ prisma: { gift: { findFirst } } }));
vi.mock("@/lib/gift-status-store", () => ({ runGiftStatusTransaction: runStatusTransaction }));

import { closeGift, undoGiftClose } from "./gift-close";

const headers = new Headers();
const NOW = new Date("2026-11-19T12:00:00.000Z");
const WINDOW_MS = 10 * 60 * 1000;

/** A row of the owner card select; the closure facts drive the answer. */
function ownerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "g1",
    title: "Наушники",
    description: null,
    priceAmount: null,
    priceCurrency: null,
    linkUrl: null,
    visibility: "PUBLIC",
    quantity: "SINGLE",
    expiresOn: null,
    archivedAt: null,
    status: "CLOSED",
    reservationPhase: null,
    holderVisibleToOwner: false,
    closedAt: new Date(NOW.getTime() - 1000),
    reservedBy: null,
    tags: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  getSession.mockResolvedValue({ user: { id: "owner" } });
  runStatusTransaction.mockImplementation(async function run(work) {
    return work({ closeGift: close, undoClose: undo });
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("closeGift (the owner marks a wish as received)", () => {
  it("answers UNAUTHENTICATED before reading the wish", async () => {
    getSession.mockResolvedValue(null);

    const result = await closeGift(headers, "g1");

    expect(result).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    expect(findFirst).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  /** AD-7: a foreign or unknown id answers one and the same NOT_FOUND. */
  it("answers NOT_FOUND with one body for a foreign or unknown wish", async () => {
    findFirst.mockResolvedValue(null);

    const result = await closeGift(headers, "g1");

    expect(result).toEqual({ ok: false, code: "NOT_FOUND", message: "Gift not found" });
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "g1", list: { ownerId: "owner" } },
      select: { status: true, archivedAt: true, closedAt: true, closedFromStatus: true },
    });
    expect(close).not.toHaveBeenCalled();
  });

  /** AD-8: the owner's own archived wish is read-only with the archived reason. */
  it("answers GIFT_ARCHIVED for the owner's archived wish", async () => {
    findFirst.mockResolvedValue(ownerRow({ status: "OPEN", archivedAt: new Date() }));

    const result = await closeGift(headers, "g1");

    expect(result).toMatchObject({ ok: false, code: "VALIDATION", reason: "GIFT_ARCHIVED" });
    expect(close).not.toHaveBeenCalled();
  });

  /** ALREADY_CLOSED: no reason, the row is not touched. */
  it("answers CONFLICT without a reason for an already closed wish", async () => {
    findFirst.mockResolvedValue(ownerRow({ status: "CLOSED" }));

    const result = await closeGift(headers, "g1");

    expect(result).toEqual({ ok: false, code: "CONFLICT", message: "Gift is already closed" });
    expect(result).not.toHaveProperty("reason");
    expect(close).not.toHaveBeenCalled();
  });

  it.each(["OPEN", "RESERVED"] as const)(
    "closes a %s wish with one CAS and answers the owner card with undoUntil",
    async (status) => {
      findFirst
        .mockResolvedValueOnce(ownerRow({ status, closedAt: null }))
        .mockResolvedValueOnce(ownerRow({ status: "CLOSED" }));
      close.mockResolvedValue("success");

      const result = await closeGift(headers, "g1");

      expect(close).toHaveBeenCalledTimes(1);
      expect(close).toHaveBeenCalledWith("g1", "owner", status, NOW);
      expect(runStatusTransaction).toHaveBeenCalledTimes(1);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toMatchObject({ id: "g1", status: "CLOSED" });
      // ARCH-A5: the moment is the server's window, not a client timer.
      expect(result.data.undoUntil).toBe(new Date(NOW.getTime() - 1000 + WINDOW_MS).toISOString());
    },
  );

  it("answers CONFLICT when the CAS lost the race", async () => {
    findFirst.mockResolvedValue(ownerRow({ status: "OPEN", closedAt: null }));
    close.mockResolvedValue("lost");

    const result = await closeGift(headers, "g1");

    expect(result).toEqual({ ok: false, code: "CONFLICT", message: "Gift is already closed" });
  });

  /**
   * D-49 (CLE-124): a reservation that landed between the read and the CAS is not
   * a CONFLICT for the owner. The action re-reads the row, closes the wish that is
   * actually there and answers the same card as for an open wish.
   */
  it("closes a wish that became RESERVED between the read and the CAS", async () => {
    findFirst
      .mockResolvedValueOnce(ownerRow({ status: "OPEN", closedAt: null }))
      .mockResolvedValueOnce(ownerRow({ status: "RESERVED", closedAt: null }))
      .mockResolvedValueOnce(ownerRow({ status: "CLOSED" }));
    close.mockResolvedValueOnce("lost").mockResolvedValueOnce("success");

    const result = await closeGift(headers, "g1");

    expect(result.ok).toBe(true);
    expect(close).toHaveBeenNthCalledWith(1, "g1", "owner", "OPEN", NOW);
    expect(close).toHaveBeenNthCalledWith(2, "g1", "owner", "RESERVED", NOW);
  });

  /** D-49: the owner's card never tells them somebody held the wish. */
  it("returns the owner card without the holder of a closed wish", async () => {
    findFirst
      .mockResolvedValueOnce(ownerRow({ status: "RESERVED" }))
      .mockResolvedValueOnce(
        ownerRow({
          reservationPhase: "ACTIVE",
          holderVisibleToOwner: true,
          reservedBy: { id: "u2", nick: "holder", name: "Даритель" },
        }),
      );
    close.mockResolvedValue("success");

    const result = await closeGift(headers, "g1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe("CLOSED");
    expect(result.data.reservedBy).toBeNull();
    expect(result.data.reservationLabel).toBeNull();
    expect(result.data.ownerAction).toBeNull();
    expect(JSON.stringify(result.data)).not.toContain("Даритель");
  });
});

describe("undoGiftClose (the owner reverts a close inside the window)", () => {
  const closedAt = new Date(NOW.getTime() - 1000);

  it("answers UNAUTHENTICATED before reading the wish", async () => {
    getSession.mockResolvedValue(null);

    const result = await undoGiftClose(headers, "g1");

    expect(result).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    expect(findFirst).not.toHaveBeenCalled();
    expect(undo).not.toHaveBeenCalled();
  });

  it("answers NOT_FOUND with one body for a foreign or unknown wish", async () => {
    findFirst.mockResolvedValue(null);

    const result = await undoGiftClose(headers, "g1");

    expect(result).toEqual({ ok: false, code: "NOT_FOUND", message: "Gift not found" });
    expect(undo).not.toHaveBeenCalled();
  });

  it("answers GIFT_ARCHIVED for the owner's archived wish", async () => {
    findFirst.mockResolvedValue(ownerRow({ archivedAt: new Date() }));

    const result = await undoGiftClose(headers, "g1");

    expect(result).toMatchObject({ ok: false, code: "VALIDATION", reason: "GIFT_ARCHIVED" });
    expect(undo).not.toHaveBeenCalled();
  });

  /** UNDO_RACE: the wish is no longer CLOSED — CONFLICT without a reason. */
  it.each(["OPEN", "RESERVED"] as const)("answers CONFLICT without a reason for a %s wish", async (status) => {
    findFirst.mockResolvedValue(ownerRow({ status }));

    const result = await undoGiftClose(headers, "g1");

    expect(result).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(result).not.toHaveProperty("reason");
    expect(undo).not.toHaveBeenCalled();
  });

  /** UNDO_NO_ORIGIN: a closed wish that does not know what it was closed from. */
  it("answers CONFLICT without a reason when the origin status is missing", async () => {
    findFirst.mockResolvedValue(ownerRow({ closedFromStatus: null }));

    const result = await undoGiftClose(headers, "g1");

    expect(result).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(result).not.toHaveProperty("reason");
    expect(undo).not.toHaveBeenCalled();
  });

  /** UNDO_LATE: exactly ten minutes later is already too late (D-43). */
  it.each([
    ["exactly ten minutes", new Date(NOW.getTime() - WINDOW_MS)],
    ["one millisecond after", new Date(NOW.getTime() - WINDOW_MS - 1)],
  ])("answers UNDO_WINDOW_EXPIRED for a wish closed %s ago", async (_label, moment) => {
    findFirst.mockResolvedValue(ownerRow({ closedAt: moment, closedFromStatus: "OPEN" }));

    const result = await undoGiftClose(headers, "g1");

    expect(result).toEqual({
      ok: false,
      code: "CONFLICT",
      message: "The undo window is closed",
      reason: "UNDO_WINDOW_EXPIRED",
    });
    expect(undo).not.toHaveBeenCalled();
  });

  it("undoes through one CAS on the read snapshot and answers the open card", async () => {
    findFirst
      .mockResolvedValueOnce(ownerRow({ closedFromStatus: "RESERVED", closedAt }))
      .mockResolvedValueOnce(ownerRow({ status: "RESERVED", closedAt: null, reservationPhase: "ACTIVE" }));
    undo.mockResolvedValue("success");

    const result = await undoGiftClose(headers, "g1");

    expect(undo).toHaveBeenCalledTimes(1);
    expect(undo).toHaveBeenCalledWith("g1", "owner", { closedAt, closedFromStatus: "RESERVED" }, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // D-49: the restored reservation still reads as an open wish to its owner.
    expect(result.data).toMatchObject({
      id: "g1",
      status: "OPEN",
      reservedBy: null,
      ownerAction: null,
      undoUntil: null,
    });
  });

  it("answers CONFLICT without a reason when the undo CAS lost the race", async () => {
    findFirst.mockResolvedValue(ownerRow({ closedFromStatus: "OPEN", closedAt }));
    undo.mockResolvedValue("lost");

    const result = await undoGiftClose(headers, "g1");

    expect(result).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(result).not.toHaveProperty("reason");
  });
});
