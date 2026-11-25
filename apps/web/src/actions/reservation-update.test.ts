import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  getSession,
  findFirst,
  userFindUnique,
  runStatusTransaction,
  relationsBetween,
  extendReservation,
  setReservationBought,
  setReservationVisibility,
  markReservationGiven,
} = vi.hoisted(() => ({
  getSession: vi.fn(),
  findFirst: vi.fn(),
  userFindUnique: vi.fn(),
  runStatusTransaction: vi.fn(),
  relationsBetween: vi.fn(),
  extendReservation: vi.fn(),
  setReservationBought: vi.fn(),
  setReservationVisibility: vi.fn(),
  markReservationGiven: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({
  prisma: {
    gift: { findFirst },
    user: { findUnique: userFindUnique },
  },
}));
vi.mock("@/lib/gift-status-store", () => ({
  runGiftStatusTransaction: runStatusTransaction,
}));
vi.mock("@/lib/relationships", () => ({
  relationshipReader: { relationsBetween },
}));

import { addCalendarDays, calendarDayInZone } from "@/domain/reservation-due";
import { reservationUpdateResult, updateMyReservation } from "./reservation-update";

const headers = new Headers();

function dueOnFromNow(days: number): string {
  return addCalendarDays(calendarDayInZone(new Date(), "UTC"), days);
}

const preflight = {
  id: "g1",
  status: "RESERVED" as const,
  reservedById: "holder",
  reservationPhase: "ACTIVE" as const,
  // CLE-124/S9b-2: an extension is allowed only while the deadline is ahead.
  reservationDueAt: new Date("2099-01-01T00:00:00.000Z"),
};

/** The row the success path re-reads for the answer. */
function cardRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "g1",
    status: "RESERVED" as const,
    title: "Плед",
    titleSnapshotOnReserve: "Плед",
    reservationDueAt: new Date("2026-12-09T00:00:00.000Z"),
    reservationTimeZone: "UTC",
    reservationPhase: "ACTIVE" as const,
    reservationBought: false,
    holderVisibleToOwner: false,
    holderVisibleToOthers: true,
    visibility: "PUBLIC" as const,
    archivedAt: null,
    reservedById: "holder",
    list: { ownerId: "owner", owner: { nick: "anna" } },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ user: { id: "holder" } });
  userFindUnique.mockResolvedValue({ timeZone: "UTC" });
  relationsBetween.mockResolvedValue({
    blocked: false,
    friend: true,
    subscriber: false,
    contactMatch: false,
  });
  runStatusTransaction.mockImplementation(async function run(work) {
    return work({
      extendReservation,
      setReservationBought,
      setReservationVisibility,
      markReservationGiven,
    });
  });
});

describe("reservationUpdateResult", () => {
  const now = new Date("2026-11-20T12:00:00.000Z");
  const future = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  it("answers NOT_FOUND for an unknown row and for another holder's row", () => {
    expect(reservationUpdateResult(null, "holder", "bought", now)).toBe("NOT_FOUND");
    expect(
      reservationUpdateResult(
        { status: "RESERVED", reservedById: "other", reservationPhase: "ACTIVE" },
        "holder",
        "bought",
        now,
      ),
    ).toBe("NOT_FOUND");
  });

  it("answers CONFLICT for the holder's row that is not RESERVED anymore", () => {
    expect(
      reservationUpdateResult(
        { status: "CLOSED", reservedById: "holder", reservationPhase: "ACTIVE" },
        "holder",
        "visibility",
        now,
      ),
    ).toBe("CONFLICT");
  });

  it("refuses an extension from GIVEN but keeps bought and visibility open", () => {
    const given = {
      status: "RESERVED" as const,
      reservedById: "holder",
      reservationPhase: "GIVEN" as const,
      reservationDueAt: future,
    };
    expect(reservationUpdateResult(given, "holder", "extend", now)).toBe("CONFLICT");
    expect(reservationUpdateResult(given, "holder", "bought", now)).toBe("ok");
    expect(reservationUpdateResult(given, "holder", "visibility", now)).toBe("ok");
  });

  it("accepts an extension only from ACTIVE before the deadline", () => {
    expect(
      reservationUpdateResult(
        { status: "RESERVED", reservedById: "holder", reservationPhase: "ACTIVE", reservationDueAt: future },
        "holder",
        "extend",
        now,
      ),
    ).toBe("ok");
  });

  it.each(["AWAITING_GIVER", "AWAITING_OWNER"] as const)(
    "answers DUE_PASSED for an extension in %s",
    (phase) => {
      expect(
        reservationUpdateResult(
          { status: "RESERVED", reservedById: "holder", reservationPhase: phase, reservationDueAt: future },
          "holder",
          "extend",
          now,
        ),
      ).toBe("DUE_PASSED");
    },
  );

  it("answers DUE_PASSED at, before and without a deadline", () => {
    for (const reservationDueAt of [now, new Date(now.getTime() - 1), null]) {
      expect(
        reservationUpdateResult(
          { status: "RESERVED", reservedById: "holder", reservationPhase: "ACTIVE", reservationDueAt },
          "holder",
          "extend",
          now,
        ),
      ).toBe("DUE_PASSED");
    }
  });

  it("refuses an extension of a reservation without a phase", () => {
    expect(
      reservationUpdateResult(
        { status: "RESERVED", reservedById: "holder", reservationPhase: null, reservationDueAt: future },
        "holder",
        "extend",
        now,
      ),
    ).toBe("CONFLICT");
  });
});

describe("updateMyReservation", () => {
  it("answers UNAUTHENTICATED before reading the wish", async () => {
    getSession.mockResolvedValue(null);

    const result = await updateMyReservation(headers, "g1", { action: "bought", value: true });

    expect(result).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    expect(findFirst).not.toHaveBeenCalled();
    expect(setReservationBought).not.toHaveBeenCalled();
  });

  it.each([
    ["an extra key", { action: "bought", value: true, dueOn: "2026-12-01" }],
    [
      "two actions in one body",
      {
        action: "visibility",
        holderVisibleToOwner: true,
        holderVisibleToOthers: false,
        value: true,
      },
    ],
    ["an unknown action", { action: "release" }],
    ["a missing value", { action: "bought" }],
    ["a non-object body", "bought"],
  ])("answers VALIDATION for %s without touching the database", async (_case, body) => {
    const result = await updateMyReservation(headers, "g1", body);

    expect(result).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(findFirst).not.toHaveBeenCalled();
    expect(extendReservation).not.toHaveBeenCalled();
    expect(setReservationBought).not.toHaveBeenCalled();
    expect(setReservationVisibility).not.toHaveBeenCalled();
  });

  it("answers NOT_FOUND for an unknown wish", async () => {
    findFirst.mockResolvedValue(null);

    const result = await updateMyReservation(headers, "g-unknown", {
      action: "bought",
      value: true,
    });

    expect(result).toEqual({ ok: false, code: "NOT_FOUND", message: "Gift not found" });
    expect(setReservationBought).not.toHaveBeenCalled();
  });

  it("answers NOT_FOUND for a wish reserved by somebody else", async () => {
    findFirst.mockResolvedValue({ ...preflight, reservedById: "other" });

    const result = await updateMyReservation(headers, "g1", { action: "bought", value: true });

    expect(result).toEqual({ ok: false, code: "NOT_FOUND", message: "Gift not found" });
    expect(setReservationBought).not.toHaveBeenCalled();
  });

  it("answers NOT_FOUND for a blank id without querying", async () => {
    const result = await updateMyReservation(headers, "  ", { action: "bought", value: true });

    expect(result).toEqual({ ok: false, code: "NOT_FOUND", message: "Gift not found" });
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("answers CONFLICT without a reason for the holder's closed wish", async () => {
    findFirst.mockResolvedValue({ ...preflight, status: "CLOSED" });

    const result = await updateMyReservation(headers, "g1", { action: "bought", value: true });

    expect(result).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(result).not.toHaveProperty("reason");
    expect(setReservationBought).not.toHaveBeenCalled();
  });

  it("extends through one CAS and answers the updated card", async () => {
    const dueOn = dueOnFromNow(10);
    findFirst
      .mockResolvedValueOnce(preflight)
      .mockResolvedValueOnce(
        cardRow({
          reservationDueAt: new Date("2026-12-09T00:00:00.000Z"),
          reservationPhase: "ACTIVE",
        }),
      );
    extendReservation.mockResolvedValue("success");

    const result = await updateMyReservation(headers, "g1", { action: "extend", dueOn });

    expect(extendReservation).toHaveBeenCalledTimes(1);
    // Story 5.5: one write of the deadline, a fresh zone snapshot and the
    // moment the phase returns to ACTIVE; bought and the toggles are not sent.
    expect(extendReservation).toHaveBeenCalledWith("g1", "holder", {
      dueAt: expect.any(Date),
      timeZone: "UTC",
      at: expect.any(Date),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.dueAt).toBe("2026-12-08");
      expect(result.data.phase).toBe("ACTIVE");
      expect(Object.keys(result.data).sort()).toEqual([
        "bought",
        "canOpenGift",
        "dueAt",
        "giftId",
        "holderVisibleToOthers",
        "holderVisibleToOwner",
        "ownerNick",
        "phase",
        "status",
        "titleSnapshot",
      ]);
    }
  });

  it("uses the holder's zone for the range and the stored deadline", async () => {
    userFindUnique.mockResolvedValue({ timeZone: "Pacific/Kiritimati" });
    findFirst.mockResolvedValueOnce(preflight).mockResolvedValueOnce(cardRow());
    extendReservation.mockResolvedValue("success");

    const dueOn = addCalendarDays(calendarDayInZone(new Date(), "Pacific/Kiritimati"), 3);
    const result = await updateMyReservation(headers, "g1", { action: "extend", dueOn });

    expect(result.ok).toBe(true);
    expect(extendReservation).toHaveBeenCalledWith(
      "g1",
      "holder",
      expect.objectContaining({ timeZone: "Pacific/Kiritimati" }),
    );
  });

  it("answers DUE_OUT_OF_RANGE with params.max for a past day", async () => {
    findFirst.mockResolvedValue(preflight);

    const result = await updateMyReservation(headers, "g1", {
      action: "extend",
      dueOn: "2000-01-01",
    });

    expect(result).toMatchObject({
      ok: false,
      code: "VALIDATION",
      reason: "DUE_OUT_OF_RANGE",
    });
    if (!result.ok) expect(result.params?.max).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
    expect(extendReservation).not.toHaveBeenCalled();
  });

  it("answers DUE_OUT_OF_RANGE for a day past today + 30", async () => {
    findFirst.mockResolvedValue(preflight);

    const result = await updateMyReservation(headers, "g1", {
      action: "extend",
      dueOn: dueOnFromNow(31),
    });

    expect(result).toMatchObject({
      ok: false,
      code: "VALIDATION",
      reason: "DUE_OUT_OF_RANGE",
    });
    expect(extendReservation).not.toHaveBeenCalled();
  });

  it("answers CONFLICT for an extension in GIVEN and writes nothing", async () => {
    findFirst.mockResolvedValue({ ...preflight, reservationPhase: "GIVEN" });

    const result = await updateMyReservation(headers, "g1", {
      action: "extend",
      dueOn: dueOnFromNow(5),
    });

    expect(result).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(result).not.toHaveProperty("reason");
    expect(extendReservation).not.toHaveBeenCalled();
  });

  it("refuses an extension from AWAITING_OWNER because the deadline has passed", async () => {
    findFirst.mockResolvedValueOnce({ ...preflight, reservationPhase: "AWAITING_OWNER" });
    extendReservation.mockResolvedValue("success");

    const result = await updateMyReservation(headers, "g1", {
      action: "extend",
      dueOn: dueOnFromNow(5),
    });

    expect(result).toMatchObject({
      ok: false,
      code: "CONFLICT",
      reason: "RESERVATION_DUE_PASSED",
    });
    expect(extendReservation).not.toHaveBeenCalled();
  });

  it("refuses an extension when the stored deadline has already passed", async () => {
    findFirst.mockResolvedValueOnce({
      ...preflight,
      reservationDueAt: new Date("2000-01-01T00:00:00.000Z"),
    });

    const result = await updateMyReservation(headers, "g1", {
      action: "extend",
      dueOn: dueOnFromNow(5),
    });

    expect(result).toMatchObject({ ok: false, code: "CONFLICT", reason: "RESERVATION_DUE_PASSED" });
    expect(extendReservation).not.toHaveBeenCalled();
  });

  it("marks the wish as bought with one attribute write", async () => {
    findFirst
      .mockResolvedValueOnce(preflight)
      .mockResolvedValueOnce(cardRow({ reservationBought: true }));
    setReservationBought.mockResolvedValue("success");

    const result = await updateMyReservation(headers, "g1", { action: "bought", value: true });

    expect(setReservationBought).toHaveBeenCalledWith("g1", "holder", { value: true });
    expect(extendReservation).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.bought).toBe(true);
  });

  it("keeps AWAITING_OWNER when the bought mark is cleared", async () => {
    findFirst
      .mockResolvedValueOnce({ ...preflight, reservationPhase: "AWAITING_OWNER", reservationBought: true })
      .mockResolvedValueOnce(cardRow({ reservationPhase: "AWAITING_OWNER", reservationBought: false }));
    setReservationBought.mockResolvedValue("success");

    const result = await updateMyReservation(headers, "g1", { action: "bought", value: false });

    expect(setReservationBought).toHaveBeenCalledWith("g1", "holder", { value: false });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.phase).toBe("AWAITING_OWNER");
      expect(result.data.bought).toBe(false);
    }
  });

  it("marks the wish as given with one phase write and answers the card", async () => {
    findFirst
      .mockResolvedValueOnce(preflight)
      .mockResolvedValueOnce(cardRow({ reservationPhase: "GIVEN" }));
    markReservationGiven.mockResolvedValue("success");

    const result = await updateMyReservation(headers, "g1", { action: "given" });

    expect(markReservationGiven).toHaveBeenCalledWith("g1", "holder", expect.any(Date));
    expect(extendReservation).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.phase).toBe("GIVEN");
      // The wish status and the deadline stay as they were.
      expect(result.data.status).toBe("RESERVED");
      expect(result.data.dueAt).toBe("2026-12-08");
    }
  });

  it("answers a repeated given in GIVEN with the same card and no second write", async () => {
    findFirst
      .mockResolvedValueOnce({ ...preflight, reservationPhase: "GIVEN" })
      .mockResolvedValueOnce(cardRow({ reservationPhase: "GIVEN" }));
    markReservationGiven.mockResolvedValue("success");

    const result = await updateMyReservation(headers, "g1", { action: "given" });

    // The store answers `success` for an idempotent press; the route returns the card.
    expect(markReservationGiven).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.phase).toBe("GIVEN");
  });

  it("writes the guests' visibility switch and ignores the owner flag", async () => {
    findFirst
      .mockResolvedValueOnce(preflight)
      .mockResolvedValueOnce(cardRow({ holderVisibleToOwner: true, holderVisibleToOthers: false }));
    setReservationVisibility.mockResolvedValue("success");

    const result = await updateMyReservation(headers, "g1", {
      action: "visibility",
      holderVisibleToOwner: true,
      holderVisibleToOthers: false,
    });

    expect(setReservationVisibility).toHaveBeenCalledWith("g1", "holder", {
      holderVisibleToOthers: false,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      // CLE-124/D-49: the stored `true` of a legacy row never reaches the client.
      expect(result.data.holderVisibleToOwner).toBe(false);
      expect(result.data.holderVisibleToOthers).toBe(false);
    }
  });

  it("accepts a visibility request without the owner flag", async () => {
    findFirst
      .mockResolvedValueOnce(preflight)
      .mockResolvedValueOnce(cardRow({ holderVisibleToOthers: true }));
    setReservationVisibility.mockResolvedValue("success");

    const result = await updateMyReservation(headers, "g1", {
      action: "visibility",
      holderVisibleToOthers: true,
    });

    expect(setReservationVisibility).toHaveBeenCalledWith("g1", "holder", {
      holderVisibleToOthers: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.holderVisibleToOwner).toBe(false);
  });

  it("keeps the actions available after a block and only closes the detail link", async () => {
    relationsBetween.mockResolvedValue({
      blocked: true,
      friend: false,
      subscriber: false,
      contactMatch: false,
    });
    findFirst.mockResolvedValueOnce(preflight).mockResolvedValueOnce(cardRow());
    extendReservation.mockResolvedValue("success");

    const result = await updateMyReservation(headers, "g1", {
      action: "extend",
      dueOn: dueOnFromNow(4),
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.canOpenGift).toBe(false);
  });

  it.each([
    ["the reservation is gone", null, "NOT_FOUND"],
    ["the wish was closed", { ...preflight, status: "CLOSED" }, "CONFLICT"],
    ["the extension ran into GIVEN", { ...preflight, reservationPhase: "GIVEN" }, "CONFLICT"],
    [
      "the deadline passed between the preflight and the write",
      { ...preflight, reservationPhase: "ACTIVE", reservationDueAt: new Date("2000-01-01T00:00:00.000Z") },
      "CONFLICT",
    ],
  ] as const)(
    "classifies a lost CAS as %s",
    async (_case, after, code) => {
      findFirst.mockResolvedValueOnce(preflight).mockResolvedValueOnce(after);
      extendReservation.mockResolvedValue("lost");

      const result = await updateMyReservation(headers, "g1", {
        action: "extend",
        dueOn: dueOnFromNow(5),
      });

      expect(result).toMatchObject({ ok: false, code });
    },
  );

  it("answers NOT_FOUND when the fresh row is somebody else's reservation", async () => {
    findFirst
      .mockResolvedValueOnce(preflight)
      .mockResolvedValueOnce(cardRow({ reservedById: "other" }));
    setReservationBought.mockResolvedValue("success");

    const result = await updateMyReservation(headers, "g1", { action: "bought", value: true });

    expect(result).toEqual({ ok: false, code: "NOT_FOUND", message: "Gift not found" });
    expect(relationsBetween).not.toHaveBeenCalled();
  });

  it("answers NOT_FOUND instead of mapping an incomplete reservation", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(function quiet() {});
    findFirst
      .mockResolvedValueOnce(preflight)
      .mockResolvedValueOnce(cardRow({ reservationPhase: null }));
    setReservationBought.mockResolvedValue("success");

    const result = await updateMyReservation(headers, "g1", { action: "bought", value: true });

    expect(result).toEqual({ ok: false, code: "NOT_FOUND", message: "Gift not found" });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("incomplete reservation"));
    warn.mockRestore();
  });
});
