import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, findFirst, updateMany, transaction } = vi.hoisted(() => ({
  getSession: vi.fn(),
  findFirst: vi.fn(),
  updateMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({
  prisma: { gift: { findFirst, updateMany }, $transaction: transaction },
}));

import {
  keepReservation,
  keepReservationResult,
  type KeepReservationRow,
} from "./gift-reservation-keep";

const headers = new Headers();
const NOW = new Date("2026-11-20T12:00:00.000Z");

/** The row the keep decides on: a live reservation waiting for the owner. */
function storedRow(overrides: Partial<KeepReservationRow> = {}) {
  const base = {
    id: "g1",
    status: "RESERVED" as const,
    archivedAt: null,
    reservationPhase: "AWAITING_OWNER" as const,
    reservationTimeZone: "Europe/Moscow",
    list: { ownerId: "owner" },
  };
  return { ...base, ...overrides };
}

/** A row of the owner card select, answered after a successful write. */
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
    status: "RESERVED",
    reservationPhase: "ACTIVE",
    holderVisibleToOwner: true,
    closedAt: null,
    reservedBy: { id: "holder", nick: "anna", name: "Анна" },
    tags: [],
    ...overrides,
  };
}

function eventLines(spy: { mock: { calls: unknown[][] } }): string[] {
  return spy.mock.calls.map((call) => String(call[0]));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  getSession.mockResolvedValue({ user: { id: "owner" } });
  updateMany.mockResolvedValue({ count: 1 });
  transaction.mockImplementation(async function run(work) {
    return work({ gift: { updateMany } });
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("keepReservation (the owner keeps the reservation)", () => {
  it("answers UNAUTHENTICATED before reading the wish", async () => {
    getSession.mockResolvedValue(null);

    const result = await keepReservation(headers, "g1", {});

    expect(result).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    expect(findFirst).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("rejects a smuggled key with its name and writes nothing", async () => {
    const result = await keepReservation(headers, "g1", { dueOn: "2026-12-08" });

    expect(result).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: "dueOn",
    });
    expect(findFirst).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  /** AD-7: a foreign or unknown id answers one and the same NOT_FOUND. */
  it("answers NOT_FOUND with one body for a foreign or unknown wish", async () => {
    findFirst.mockResolvedValue(null);

    const result = await keepReservation(headers, "g1", {});

    expect(result).toEqual({ ok: false, code: "NOT_FOUND", message: "Gift not found" });
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "g1", list: { ownerId: "owner" } },
      select: {
        id: true,
        status: true,
        archivedAt: true,
        reservationPhase: true,
        reservationTimeZone: true,
        list: { select: { ownerId: true } },
      },
    });
    expect(updateMany).not.toHaveBeenCalled();
  });

  /** AD-8: an archived wish of the owner is read-only, with the archived reason. */
  it("answers GIFT_ARCHIVED for an archived wish", async () => {
    findFirst.mockResolvedValue(storedRow({ archivedAt: new Date() }));

    const result = await keepReservation(headers, "g1", {});

    expect(result).toMatchObject({ ok: false, code: "VALIDATION", reason: "GIFT_ARCHIVED" });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it.each([
    ["ACTIVE", "RESERVED"],
    ["AWAITING_GIVER", "RESERVED"],
    ["GIVEN", "RESERVED"],
    [null, "OPEN"],
    [null, "CLOSED"],
  ] as const)("answers CONFLICT for phase %s in status %s", async (phase, status) => {
    findFirst.mockResolvedValue(storedRow({ reservationPhase: phase, status }));

    const result = await keepReservation(headers, "g1", {});

    expect(result).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(result).not.toHaveProperty("reason");
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("moves the phase to ACTIVE and the deadline to the end of today+7 in the saved zone", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    findFirst.mockResolvedValueOnce(storedRow()).mockResolvedValueOnce(ownerRow());

    const result = await keepReservation(headers, "g1", {});

    const expectedDueAt = new Date("2026-11-27T21:00:00.000Z");
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: "g1",
        status: "RESERVED",
        archivedAt: null,
        reservationPhase: "AWAITING_OWNER",
        list: { ownerId: "owner" },
      },
      data: {
        reservationPhase: "ACTIVE",
        reservationPhaseAt: NOW,
        reservationDueAt: expectedDueAt,
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({
      id: "g1",
      status: "RESERVED",
      ownerAction: null,
    });
    // AD-7: the owner card never carries the reservation facts.
    expect(result.data).not.toHaveProperty("reservation");
    expect(result.data).not.toHaveProperty("dueAt");
    expect(result.data).not.toHaveProperty("phase");
    expect(result.data).not.toHaveProperty("bought");
    expect(info).toHaveBeenCalledTimes(1);
    expect(eventLines(info)[0]).toContain("gift.reservation.kept-by-owner");
    expect(eventLines(info)[0]).toContain('"giftId":"g1"');
    expect(eventLines(info)[0]).toContain('"actorId":"owner"');
    info.mockRestore();
  });

  /** KEEP_BOUGHT: the keep does not look at `bought` and never changes it. */
  it("keeps a reservation the holder marked as bought, without touching the mark", async () => {
    findFirst.mockResolvedValueOnce(storedRow()).mockResolvedValueOnce(ownerRow());

    const result = await keepReservation(headers, "g1", {});

    expect(result.ok).toBe(true);
    const call = updateMany.mock.calls[0][0] as { where: Record<string, unknown>; data: Record<string, unknown> };
    expect(call.where).not.toHaveProperty("reservationBought");
    expect(call.data).not.toHaveProperty("reservationBought");
    expect(call.data).not.toHaveProperty("reservationTimeZone");
    expect(call.data).not.toHaveProperty("status");
  });

  /** KEEP_ZONE_UNKNOWN: a blank or unknown snapshot counts in UTC, never throws. */
  it.each([null, "", "Not/AZone"])(
    "counts the deadline in UTC when the saved zone is %s",
    async (zone) => {
      findFirst
        .mockResolvedValueOnce(storedRow({ reservationTimeZone: zone }))
        .mockResolvedValueOnce(ownerRow());

      const result = await keepReservation(headers, "g1", {});

      expect(result.ok).toBe(true);
      expect(updateMany.mock.calls[0][0].data.reservationDueAt).toEqual(
        new Date("2026-11-28T00:00:00.000Z"),
      );
    },
  );

  it("answers CONFLICT and keeps the card when the CAS lost to the timer", async () => {
    findFirst.mockResolvedValueOnce(storedRow()).mockResolvedValueOnce({ id: "g1" });
    updateMany.mockResolvedValue({ count: 0 });

    const result = await keepReservation(headers, "g1", {});

    expect(result).toEqual({
      ok: false,
      code: "CONFLICT",
      message: "The reservation cannot be kept",
    });
    // The write failed, so only the preflight and the re-read ran.
    expect(findFirst).toHaveBeenCalledTimes(2);
  });

  it("answers NOT_FOUND when the row is gone after the lost CAS", async () => {
    findFirst.mockResolvedValueOnce(storedRow()).mockResolvedValueOnce(null);
    updateMany.mockResolvedValue({ count: 0 });

    const result = await keepReservation(headers, "g1", {});

    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  it("writes no event on a refusal", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    findFirst.mockResolvedValue(storedRow({ reservationPhase: "ACTIVE" }));

    await keepReservation(headers, "g1", {});

    expect(info).not.toHaveBeenCalled();
    info.mockRestore();
  });
});

describe("keepReservationResult", () => {
  it("tells a foreign row from an archived one and from another phase", () => {
    expect(keepReservationResult(null, "owner")).toBe("NOT_FOUND");
    expect(
      keepReservationResult(storedRow({ list: { ownerId: "somebody" } }), "owner"),
    ).toBe("NOT_FOUND");
    expect(keepReservationResult(storedRow({ archivedAt: new Date() }), "owner")).toBe("ARCHIVED");
    expect(keepReservationResult(storedRow({ reservationPhase: "ACTIVE" }), "owner")).toBe(
      "CONFLICT",
    );
    expect(keepReservationResult(storedRow(), "owner")).toBe("ok");
  });
});
