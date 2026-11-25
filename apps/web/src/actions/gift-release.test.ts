import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  getSession,
  findFirst,
  transaction,
  runStatusTransaction,
  releaseByHolder,
  releaseByOwner,
} = vi.hoisted(() => ({
  getSession: vi.fn(),
  findFirst: vi.fn(),
  transaction: vi.fn(),
  runStatusTransaction: vi.fn(),
  releaseByHolder: vi.fn(),
  releaseByOwner: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({
  prisma: { gift: { findFirst }, $transaction: transaction },
}));
vi.mock("@/lib/gift-status-store", () => ({
  runGiftStatusTransaction: runStatusTransaction,
}));

import {
  previewReservationRelease,
  releaseMyReservation,
  releaseReservationAsOwner,
} from "./gift-release";

const headers = new Headers();

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ user: { id: "holder" } });
  transaction.mockImplementation(async function run(fn) {
    return fn({});
  });
  runStatusTransaction.mockImplementation(async function run(work) {
    return work({ releaseReservationByHolder: releaseByHolder, releaseReservationByOwner: releaseByOwner });
  });
});

describe("releaseMyReservation (the holder)", () => {
  it("answers UNAUTHENTICATED before reading the wish", async () => {
    getSession.mockResolvedValue(null);

    const result = await releaseMyReservation(headers, "g1");

    expect(result).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    expect(findFirst).not.toHaveBeenCalled();
    expect(releaseByHolder).not.toHaveBeenCalled();
  });

  it("answers NOT_FOUND with one body when the wish is not this holder's live reservation", async () => {
    findFirst.mockResolvedValue(null);

    const result = await releaseMyReservation(headers, "g1");

    expect(result).toEqual({ ok: false, code: "NOT_FOUND", message: "Gift not found" });
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "g1", status: "RESERVED", reservedById: "holder" },
      select: { id: true },
    });
    expect(releaseByHolder).not.toHaveBeenCalled();
  });

  it("releases through one CAS and answers { id }", async () => {
    findFirst.mockResolvedValue({ id: "g1" });
    releaseByHolder.mockResolvedValue("success");

    const result = await releaseMyReservation(headers, "g1");

    expect(result).toEqual({ ok: true, data: { id: "g1" } });
    expect(releaseByHolder).toHaveBeenCalledTimes(1);
    expect(releaseByHolder).toHaveBeenCalledWith("g1", "holder", expect.any(Date));
    expect(runStatusTransaction).toHaveBeenCalledTimes(1);
  });

  it("answers CONFLICT when the reservation is gone between the read and the CAS", async () => {
    findFirst.mockResolvedValue({ id: "g1" });
    releaseByHolder.mockResolvedValue("lost");

    const result = await releaseMyReservation(headers, "g1");

    expect(result).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(releaseByHolder).toHaveBeenCalledTimes(1);
  });
});

describe("previewReservationRelease (the owner's preflight)", () => {
  beforeEach(() => {
    getSession.mockResolvedValue({ user: { id: "owner" } });
  });

  it("answers UNAUTHENTICATED before reading the wish", async () => {
    getSession.mockResolvedValue(null);

    const result = await previewReservationRelease(headers, "g1");

    expect(result).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("masks a foreign or unknown wish as NOT_FOUND", async () => {
    findFirst.mockResolvedValue(null);

    const result = await previewReservationRelease(headers, "g1");

    expect(result).toEqual({ ok: false, code: "NOT_FOUND", message: "Gift not found" });
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "g1", list: { ownerId: "owner" } },
      select: { status: true, reservationBought: true },
    });
  });

  it("warns BOUGHT when the holder marked the gift as bought", async () => {
    findFirst.mockResolvedValue({ status: "RESERVED", reservationBought: true });

    const result = await previewReservationRelease(headers, "g1");

    // The answer carries the warning and nothing else — no holder, no dates (FR-31).
    expect(result).toEqual({ ok: true, data: { warning: "BOUGHT" } });
  });

  it("answers null when the holder marked nothing", async () => {
    findFirst.mockResolvedValue({ status: "RESERVED", reservationBought: false });

    const result = await previewReservationRelease(headers, "g1");

    expect(result).toEqual({ ok: true, data: { warning: null } });
  });

  it.each(["OPEN", "CLOSED"] as const)(
    "answers null for a %s wish and never argues with a stale state",
    async (status) => {
      findFirst.mockResolvedValue({ status, reservationBought: true });

      const result = await previewReservationRelease(headers, "g1");

      expect(result).toEqual({ ok: true, data: { warning: null } });
    },
  );

  it("does not answer GIVEN before Story 5.7", async () => {
    findFirst.mockResolvedValue({ status: "RESERVED", reservationBought: true });

    const result = await previewReservationRelease(headers, "g1");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.warning).not.toBe("GIVEN");
  });
});

describe("releaseReservationAsOwner (the owner)", () => {
  beforeEach(() => {
    getSession.mockResolvedValue({ user: { id: "owner" } });
  });

  it("answers UNAUTHENTICATED before the CAS", async () => {
    getSession.mockResolvedValue(null);

    const result = await releaseReservationAsOwner(headers, "g1");

    expect(result).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    expect(releaseByOwner).not.toHaveBeenCalled();
  });

  it("releases a foreign reservation through one CAS and answers { id }", async () => {
    releaseByOwner.mockResolvedValue("success");

    const result = await releaseReservationAsOwner(headers, "g1");

    expect(result).toEqual({ ok: true, data: { id: "g1" } });
    expect(releaseByOwner).toHaveBeenCalledWith("g1", "owner", expect.any(Date));
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("answers CONFLICT when the owner's own wish still exists but the CAS lost", async () => {
    releaseByOwner.mockResolvedValue("lost");
    findFirst.mockResolvedValue({ status: "OPEN" });

    const result = await releaseReservationAsOwner(headers, "g1");

    expect(result).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "g1", list: { ownerId: "owner" } },
      select: { status: true },
    });
  });

  it("answers NOT_FOUND with one body when a lost CAS leaves no row in the owner's list", async () => {
    releaseByOwner.mockResolvedValue("lost");
    findFirst.mockResolvedValue(null);

    const result = await releaseReservationAsOwner(headers, "g1");

    expect(result).toEqual({ ok: false, code: "NOT_FOUND", message: "Gift not found" });
  });
});
