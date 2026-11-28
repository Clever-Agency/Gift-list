import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, findFirst, runStatusTransaction, releaseByHolder } = vi.hoisted(() => ({
  getSession: vi.fn(),
  findFirst: vi.fn(),
  runStatusTransaction: vi.fn(),
  releaseByHolder: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({ prisma: { gift: { findFirst } } }));
vi.mock("@/lib/gift-status-store", () => ({
  runGiftStatusTransaction: runStatusTransaction,
}));

import { releaseMyReservation } from "./gift-release";

const headers = new Headers();

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ user: { id: "holder" } });
  runStatusTransaction.mockImplementation(async function run(work) {
    return work({ releaseReservationByHolder: releaseByHolder });
  });
});

/**
 * Story 5.2 / AD-7: the holder's own route keeps its contract. The owner has no
 * route and no action at all (CLE-124/D-49): the owner's endpoints answer exactly
 * like a missing resource — the catch-all 404 envelope (see the AD-15 invariant
 * `owner-symmetry.test.ts` in `src/invariants/ad15`).
 */
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
