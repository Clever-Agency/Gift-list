import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { transaction } = vi.hoisted(() => ({ transaction: vi.fn() }));

vi.mock("@/db/client", () => ({ prisma: { $transaction: transaction } }));

import type { Prisma, PrismaClient } from "@/db/generated/client";
import { RESERVATION_RELEASE_DATA } from "@/domain/gift-status";
import {
  giftStatusTransaction,
  processReservationTimers,
  processWishExpiry,
  recordGiftEvent,
  restoreFromArchive,
  runGiftStatusTransaction,
} from "./gift-status-store";

const updateMany = vi.fn();
const findMany = vi.fn();
const findUnique = vi.fn();
const createMany = vi.fn();
const deleteMany = vi.fn();
const queryRaw = vi.fn();
const reservedAt = new Date("2026-11-10T12:00:00Z");
const reservationPhaseAt = new Date("2026-11-11T12:00:00Z");
const reservationDueAt = new Date("2026-11-09T12:00:00Z");

function transactionClient(): Prisma.TransactionClient {
  return { $queryRaw: queryRaw, gift: { updateMany, findUnique }, notification: { createMany, deleteMany } } as unknown as Prisma.TransactionClient;
}

function expiryClient(): PrismaClient {
  return { gift: { findMany, updateMany } } as unknown as PrismaClient;
}

/** Story 5.6: the timer reads candidates and runs one transaction per row. */
function timerClient(): Pick<PrismaClient, "gift" | "$transaction"> {
  return {
    gift: { findMany, updateMany },
    $transaction: transaction,
  } as unknown as Pick<PrismaClient, "gift" | "$transaction">;
}

function commitEachTransaction(): void {
  transaction.mockImplementation(
    async function runInTransaction(work: (tx: Prisma.TransactionClient) => Promise<unknown>) {
      return work(transactionClient());
    },
  );
}

beforeEach(() => {
  updateMany.mockReset();
  findMany.mockReset();
  findUnique.mockReset();
  transaction.mockReset();
  createMany.mockReset();
  deleteMany.mockReset();
  queryRaw.mockReset();
  queryRaw.mockImplementation(async function query(strings: TemplateStringsArray) {
    if (strings[0]?.includes("clock_timestamp")) return [{ now: new Date() }];
    return [{ status: "CLOSED", closedAt: null }];
  });
  updateMany.mockResolvedValue({ count: 1 });
  // Story 5.6 (R1): the expiry release reads the holder before its CAS.
  findUnique.mockResolvedValue({
    id: "g1",
    status: "RESERVED",
    reservedById: "u2",
    reservedAt,
    reservationPhaseAt,
    reservationDueAt,
    reservationTimeZone: "UTC",
    title: "Плед",
    titleSnapshotOnReserve: "Плед",
    list: { ownerId: "u1" },
  });
});

/** NFR-6: one audit line per successful transition, none on a lost CAS. */
function expectOneAuditLine(
  calls: readonly (readonly unknown[])[],
  expected: Record<string, unknown>,
) {
  expect(calls).toHaveLength(1);
  const line = calls[0]?.[0];
  expect(typeof line).toBe("string");
  const parsed = JSON.parse(String(line)) as Record<string, unknown>;
  expect(parsed).toEqual(expected);
}

describe("giftStatusTransaction.releaseReservation", () => {
  it("writes status OPEN and clears the reservation columns of a RESERVED row through one CAS write", async () => {
    updateMany.mockResolvedValue({ count: 1 });

    const released = await giftStatusTransaction(transactionClient()).releaseReservation("g1");

    expect(released).toBe(true);
    expect(RESERVATION_RELEASE_DATA.status).toBe("OPEN");
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "g1", status: "RESERVED" },
      data: RESERVATION_RELEASE_DATA,
    });
  });

  it("reserves an OPEN SINGLE row with CAS and answers lost when the row moved", async () => {
    updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const tx = giftStatusTransaction(transactionClient());
    const at = new Date("2026-06-15T10:00:00.000Z");
    const data = {
      reservedById: "u2",
      reservedAt: at,
      titleSnapshotOnReserve: "Gift",
      reservationDueAt: new Date("2026-06-22T00:00:00.000Z"),
      reservationTimeZone: "UTC",
      reservationPhaseAt: at,
      holderVisibleToOthers: true,
    };

    await expect(tx.reserveGift("g1", data)).resolves.toBe("success");
    await expect(tx.reserveGift("g1", data)).resolves.toBe("lost");
    expect(updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: "g1", status: "OPEN", quantity: "SINGLE", archivedAt: null },
      data: {
        status: "RESERVED",
        reservedById: "u2",
        reservedAt: at,
        titleSnapshotOnReserve: "Gift",
        reservationDueAt: data.reservationDueAt,
        reservationTimeZone: "UTC",
        reservationPhase: "ACTIVE",
        reservationPhaseAt: at,
        reservationBought: false,
        holderVisibleToOwner: false,
        holderVisibleToOthers: true,
      },
    });
    // CLE-124: the owner is not told about the reservation at all.
    expect(createMany).not.toHaveBeenCalled();
  });

  it("writes nothing for a row that is no longer reserved", async () => {
    updateMany.mockResolvedValue({ count: 0 });

    const released = await giftStatusTransaction(transactionClient()).releaseReservation("g1");

    expect(released).toBe(false);
    expect(updateMany).toHaveBeenCalledTimes(1);
  });
});

describe("the Story 5.2 releases", () => {
  it("lets the holder release with the holder predicate and logs one audit line", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const at = new Date("2026-11-19T10:00:00.000Z");

    const outcome = await giftStatusTransaction(transactionClient()).releaseReservationByHolder(
      "g1",
      "u2",
      at,
    );

    expect(outcome).toBe("success");
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "g1", status: "RESERVED", reservedAt, reservedById: "u2" },
      data: RESERVATION_RELEASE_DATA,
    });
    // The audit line carries ids and the transition only — no names, nicks or emails (FR-31).
    expectOneAuditLine(info.mock.calls, {
      event: "gift.status",
      giftId: "g1",
      actorId: "u2",
      from: "RESERVED",
      to: "OPEN",
      at: "2026-11-19T10:00:00.000Z",
    });
    // CLE-124: the owner learns nothing, so the holder's release writes no row.
    expect(createMany).not.toHaveBeenCalled();
    info.mockRestore();
  });

  it("writes and logs nothing when the holder release loses the CAS", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    updateMany.mockResolvedValue({ count: 0 });

    const outcome = await giftStatusTransaction(transactionClient()).releaseReservationByHolder(
      "g1",
      "u2",
      new Date("2026-11-19T10:00:00.000Z"),
    );

    expect(outcome).toBe("lost");
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(info).not.toHaveBeenCalled();
    expect(createMany).not.toHaveBeenCalled();
    info.mockRestore();
  });

  it("counts a CAS that touched two rows as lost and keeps the log silent", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    updateMany.mockResolvedValue({ count: 2 });

    const outcome = await giftStatusTransaction(transactionClient()).releaseReservationByHolder(
      "g1",
      "u2",
      new Date("2026-11-19T10:00:00.000Z"),
    );

    expect(outcome).toBe("lost");
    expect(info).not.toHaveBeenCalled();
    info.mockRestore();
  });
});

describe("the Story 5.3 close and undo", () => {
  const at = new Date("2026-11-19T12:00:00.000Z");
  const WINDOW_MS = 10 * 60 * 1000;

  beforeEach(function freezeClock() {
    vi.useFakeTimers();
    vi.setSystemTime(at);
  });
  afterEach(function restoreClock() {
    vi.useRealTimers();
  });

  it.each(["OPEN", "RESERVED"] as const)(
    "closes a %s wish of the owner with one CAS and one audit line",
    async (from) => {
      const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

      const outcome = await giftStatusTransaction(transactionClient()).closeGift(
        "g1",
        "u1",
        from,
        at,
      );

      expect(outcome).toBe("success");
      expect(updateMany).toHaveBeenCalledWith({
        where: {
          id: "g1",
          status: from,
          archivedAt: null,
          list: { ownerId: "u1" },
        },
        data: { status: "CLOSED", closedAt: at, closedFromStatus: from },
      });
      if (from === "RESERVED") {
        expect(createMany).toHaveBeenCalledExactlyOnceWith({
          skipDuplicates: true,
          data: expect.objectContaining({
            kind: "GIFT_CLOSED",
            recipientId: "u2",
            emailRequired: true,
            createdAt: at,
            deliverAfter: new Date(at.getTime() + WINDOW_MS),
          }),
        });
      } else {
        expect(createMany).not.toHaveBeenCalled();
      }
      expectOneAuditLine(info.mock.calls, {
        event: "gift.status",
        giftId: "g1",
        actorId: "u1",
        from,
        to: "CLOSED",
        at: "2026-11-19T12:00:00.000Z",
      });
      info.mockRestore();
    },
  );

  it("never rewrites reserved, quantity or visibility columns when closing", async () => {
    await giftStatusTransaction(transactionClient()).closeGift("g1", "u1", "RESERVED", at);

    const { data } = updateMany.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(Object.keys(data).sort()).toEqual(["closedAt", "closedFromStatus", "status"]);
    expect(data).not.toHaveProperty("reservedById");
    expect(data).not.toHaveProperty("quantity");
    expect(data).not.toHaveProperty("visibility");
  });

  it.each([0, 2])("writes and logs nothing when the close CAS touches %i rows", async (count) => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    updateMany.mockResolvedValue({ count });

    const outcome = await giftStatusTransaction(transactionClient()).closeGift(
      "g1",
      "u1",
      "RESERVED",
      at,
    );

    expect(outcome).toBe("lost");
    expect(createMany).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
    info.mockRestore();
  });

  it("restores the origin status and clears the closure columns on undo", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const closedAt = new Date("2026-11-19T11:55:00.000Z");

    const outcome = await giftStatusTransaction(transactionClient()).undoClose(
      "g1",
      "u1",
      { closedAt, closedFromStatus: "RESERVED" },
      at,
    );

    expect(outcome).toBe("success");
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: "g1",
        status: "CLOSED",
        closedAt: { equals: closedAt, gt: new Date(at.getTime() - WINDOW_MS) },
        closedFromStatus: "RESERVED",
        list: { ownerId: "u1" },
      },
      data: { status: "RESERVED", closedAt: null, closedFromStatus: null },
    });
    expect(deleteMany).toHaveBeenCalledExactlyOnceWith({
      where: { eventKey: `GIFT_CLOSED:g1:${closedAt.toISOString()}` },
    });
    expect(queryRaw.mock.invocationCallOrder[0]).toBeLessThan(updateMany.mock.invocationCallOrder[0]!);
    expect(updateMany.mock.invocationCallOrder[0]).toBeLessThan(deleteMany.mock.invocationCallOrder[0]!);
    expectOneAuditLine(info.mock.calls, {
      event: "gift.status",
      giftId: "g1",
      actorId: "u1",
      from: "CLOSED",
      to: "RESERVED",
      at: "2026-11-19T12:00:00.000Z",
    });
    info.mockRestore();
  });

  it("answers lost and logs nothing when the undo CAS touches no row", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    updateMany.mockResolvedValue({ count: 0 });

    const outcome = await giftStatusTransaction(transactionClient()).undoClose(
      "g1",
      "u1",
      { closedAt: new Date("2026-11-19T11:55:00.000Z"), closedFromStatus: "OPEN" },
      at,
    );

    expect(outcome).toBe("lost");
    expect(deleteMany).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
    info.mockRestore();
  });
  it("refuses undo when the deadline passes while waiting on the Gift lock", async function lateLock() {
    const closedAt = new Date(at.getTime() - WINDOW_MS + 1);
    queryRaw.mockImplementationOnce(async function waitedForLock() {
      vi.setSystemTime(new Date(at.getTime() + 1));
      return [{ status: "CLOSED", closedAt }];
    });
    await expect(giftStatusTransaction(transactionClient()).undoClose(
      "g1", "u1", { closedAt, closedFromStatus: "RESERVED" }, at,
    )).resolves.toBe("lost");
    expect(updateMany).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
  });
});

/**
 * Story 5.5 (AD-9): the holder's extension, «Купил» and the visibility toggles.
 * Every one is a full-predicate CAS; the status stays `RESERVED`, so no audit
 * line is written (NFR-6 counts a status transition only).
 */
describe("the Story 5.5 reservation attributes", () => {
  const actorId = "u2";
  const at = new Date("2026-11-20T09:00:00.000Z");
  const dueAt = new Date("2026-12-08T21:00:00.000Z");

  it("extends with the holder predicate, the ACTIVE phase and a future deadline in one CAS", async () => {
    const outcome = await giftStatusTransaction(transactionClient()).extendReservation(
      "g1",
      actorId,
      { dueAt, timeZone: "Europe/Moscow", at },
    );

    expect(outcome).toBe("success");
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: "g1",
        status: "RESERVED",
        reservedById: actorId,
        // CLE-124/S9b-2: only ACTIVE, and only before the deadline.
        reservationPhase: { in: ["ACTIVE"] },
        reservationDueAt: { gt: at },
      },
      data: {
        reservationDueAt: dueAt,
        reservationTimeZone: "Europe/Moscow",
        reservationPhase: "ACTIVE",
        reservationPhaseAt: at,
      },
    });
  });

  it("never writes bought, the toggles or the title snapshot on an extension", async () => {
    await giftStatusTransaction(transactionClient()).extendReservation("g1", actorId, {
      dueAt,
      timeZone: "UTC",
      at,
    });

    const { data } = updateMany.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(Object.keys(data).sort()).toEqual([
      "reservationDueAt",
      "reservationPhase",
      "reservationPhaseAt",
      "reservationTimeZone",
    ]);
  });

  it("writes only reservationBought, so the phase and its moment stay", async () => {
    const outcome = await giftStatusTransaction(transactionClient()).setReservationBought(
      "g1",
      actorId,
      { value: true },
    );

    expect(outcome).toBe("success");
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "g1", status: "RESERVED", reservedById: actorId },
      data: { reservationBought: true },
    });
    const { data } = updateMany.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(Object.keys(data)).toEqual(["reservationBought"]);
  });

  it("writes the guests' toggle and always false for the owner, so the phase, its moment and bought stay", async () => {
    const outcome = await giftStatusTransaction(transactionClient()).setReservationVisibility(
      "g1",
      actorId,
      { holderVisibleToOthers: false },
    );

    expect(outcome).toBe("success");
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "g1", status: "RESERVED", reservedById: actorId },
      data: { holderVisibleToOwner: false, holderVisibleToOthers: false },
    });
    const { data } = updateMany.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(Object.keys(data).sort()).toEqual(["holderVisibleToOthers", "holderVisibleToOwner"]);
    expect(data).not.toHaveProperty("reservationPhaseAt");
    expect(data).not.toHaveProperty("reservationBought");
  });

  it.each([0, 2])("answers lost when a Story 5.5 CAS touches %i rows", async (count) => {
    updateMany.mockResolvedValue({ count });
    const tx = giftStatusTransaction(transactionClient());

    await expect(
      tx.extendReservation("g1", actorId, { dueAt, timeZone: "UTC", at }),
    ).resolves.toBe("lost");
    await expect(tx.setReservationBought("g1", actorId, { value: false })).resolves.toBe("lost");
    await expect(
      tx.setReservationVisibility("g1", actorId, {
        holderVisibleToOthers: true,
      }),
    ).resolves.toBe("lost");
    expect(updateMany).toHaveBeenCalledTimes(3);
  });

  it("writes no audit line, because the status never changes", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const tx = giftStatusTransaction(transactionClient());

    await tx.extendReservation("g1", actorId, { dueAt, timeZone: "UTC", at });
    await tx.setReservationBought("g1", actorId, { value: true });
    await tx.setReservationVisibility("g1", actorId, {
      holderVisibleToOthers: true,
    });

    expect(info).not.toHaveBeenCalled();
    info.mockRestore();
  });
});

/**
 * CLE-124/S9b-2 (Story 5.7): «Подарил» and the reminder before the deadline.
 */
describe("CLE-124/S9b-2: «Подарил» and the deadline reminder", () => {
  const at = new Date("2026-11-20T09:00:00.000Z");
  const snapshot = {
    id: "g1",
    status: "RESERVED",
    archivedAt: null,
    reservedById: "u2",
    reservedAt,
    reservationPhase: "ACTIVE",
    reservationPhaseAt,
    reservationDueAt: new Date("2026-12-01T00:00:00.000Z"),
    reservationTimeZone: "UTC",
    title: "Плед",
    titleSnapshotOnReserve: "Плед",
    list: { ownerId: "u1" },
  };

  it("moves a live reservation to GIVEN with one CAS and queues the owner's general letter", async () => {
    findUnique.mockResolvedValue(snapshot);
    const outcome = await giftStatusTransaction(transactionClient()).markReservationGiven(
      "g1",
      "u2",
      at,
    );

    expect(outcome).toBe("success");
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: "g1",
        status: "RESERVED",
        reservedById: "u2",
        reservedAt,
        reservationPhase: { in: ["ACTIVE", "AWAITING_GIVER", "AWAITING_OWNER"] },
      },
      data: { reservationPhase: "GIVEN", reservationPhaseAt: at },
    });
    // The wish status, the deadline and `bought` are not touched by the write.
    const { data } = updateMany.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(Object.keys(data).sort()).toEqual(["reservationPhase", "reservationPhaseAt"]);

    // No title, no gift id and no holder reach the owner's letter.
    expect(createMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: "GIFT_GIVEN",
        recipientId: "u1",
        emailRequired: true,
        payload: {},
      }),
      skipDuplicates: true,
    });
    const stored = (createMany.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(stored).not.toHaveProperty("giftId");
    expect(stored).not.toHaveProperty("actorId");
    const payload = (createMany.mock.calls[0]?.[0] as { data: { payload: unknown } }).data.payload;
    expect(JSON.stringify(payload)).not.toContain("Плед");
    expect(JSON.stringify(payload)).not.toContain("u2");
  });

  it("answers a repeated given in GIVEN with success and sends nothing again", async () => {
    findUnique.mockResolvedValue({ ...snapshot, reservationPhase: "GIVEN" });

    await expect(
      giftStatusTransaction(transactionClient()).markReservationGiven("g1", "u2", at),
    ).resolves.toBe("success");

    expect(updateMany).not.toHaveBeenCalled();
    expect(createMany).not.toHaveBeenCalled();
  });

  it("answers success when two presses race and the other one already wrote GIVEN", async () => {
    findUnique
      .mockResolvedValueOnce(snapshot)
      .mockResolvedValueOnce({ ...snapshot, reservationPhase: "GIVEN" });
    updateMany.mockResolvedValue({ count: 0 });

    await expect(
      giftStatusTransaction(transactionClient()).markReservationGiven("g1", "u2", at),
    ).resolves.toBe("success");

    expect(createMany).not.toHaveBeenCalled();
  });

  it("refuses somebody else's reservation, a released one and a closed wish", async () => {
    const tx = giftStatusTransaction(transactionClient());
    findUnique.mockResolvedValue({ ...snapshot, reservedById: "other" });
    await expect(tx.markReservationGiven("g1", "u2", at)).resolves.toBe("lost");
    findUnique.mockResolvedValue({ ...snapshot, status: "OPEN", reservedById: null });
    await expect(tx.markReservationGiven("g1", "u2", at)).resolves.toBe("lost");
    findUnique.mockResolvedValue(null);
    await expect(tx.markReservationGiven("g1", "u2", at)).resolves.toBe("lost");

    expect(updateMany).not.toHaveBeenCalled();
    expect(createMany).not.toHaveBeenCalled();
  });

  it("queues the holder's reminder 1–2 days before the deadline, never the owner's", async () => {
    const dueAt = new Date(at.getTime() + 24 * 60 * 60 * 1000);
    findUnique.mockResolvedValue({ ...snapshot, reservationDueAt: dueAt });

    await expect(
      giftStatusTransaction(transactionClient()).remindReservationDue("g1", at),
    ).resolves.toBe("success");

    expect(updateMany).not.toHaveBeenCalled();
    const { data } = createMany.mock.calls[0]?.[0] as {
      data: { kind: string; recipientId: string; eventKey: string; payload: Record<string, unknown> };
    };
    expect(data.kind).toBe("RESERVATION_DUE");
    expect(data.recipientId).toBe("u2");
    expect(data.eventKey).toBe(`RESERVATION_DUE:reminder:g1:${dueAt.toISOString()}`);
    expect(data.payload).toMatchObject({
      role: "holder",
      dueAt: dueAt.toISOString(),
      timeZone: "UTC",
      reminder: true,
    });
  });

  it("does not remind at the deadline, outside the 48-hour window, in GIVEN or in an archive", async () => {
    const tx = giftStatusTransaction(transactionClient());
    const outside = new Date(at.getTime() + 49 * 60 * 60 * 1000);
    findUnique.mockResolvedValue({ ...snapshot, reservationDueAt: at });
    await expect(tx.remindReservationDue("g1", at)).resolves.toBe("lost");
    findUnique.mockResolvedValue({ ...snapshot, reservationDueAt: outside });
    await expect(tx.remindReservationDue("g1", at)).resolves.toBe("lost");
    findUnique.mockResolvedValue({ ...snapshot, reservationPhase: "GIVEN" });
    await expect(tx.remindReservationDue("g1", at)).resolves.toBe("lost");
    findUnique.mockResolvedValue({ ...snapshot, archivedAt: at });
    await expect(tx.remindReservationDue("g1", at)).resolves.toBe("lost");

    expect(createMany).not.toHaveBeenCalled();
  });

  it("keeps one event key per deadline and starts a new one after an extension", async () => {
    const tx = giftStatusTransaction(transactionClient());
    const firstDue = new Date(at.getTime() + 24 * 60 * 60 * 1000);
    findUnique.mockResolvedValue({ ...snapshot, reservationDueAt: firstDue });
    await tx.remindReservationDue("g1", at);
    await tx.remindReservationDue("g1", new Date(at.getTime() + 60 * 60 * 1000));

    const secondDue = new Date(at.getTime() + 48 * 60 * 60 * 1000);
    findUnique.mockResolvedValue({ ...snapshot, reservationDueAt: secondDue });
    await tx.remindReservationDue("g1", at);

    expect(createMany.mock.calls.map(([args]) => (args as { data: { eventKey: string } }).data.eventKey)).toEqual([
      `RESERVATION_DUE:reminder:g1:${firstDue.toISOString()}`,
      `RESERVATION_DUE:reminder:g1:${firstDue.toISOString()}`,
      `RESERVATION_DUE:reminder:g1:${secondDue.toISOString()}`,
    ]);
  });

  it("gives the reminder and the deadline notice at the same moment two different keys", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const dueAt = new Date(at.getTime() + 24 * 60 * 60 * 1000);
    findUnique.mockResolvedValue({ ...snapshot, reservationDueAt: dueAt });
    const tx = giftStatusTransaction(transactionClient());

    // The reminder lands earlier, anchored on the deadline; the timer then sees
    // `at == dueAt` and writes «Срок истёк» for the same gift and the same date.
    await tx.remindReservationDue("g1", at);
    await tx.moveReservationToAwaitingGiver("g1", dueAt);

    const keys = createMany.mock.calls.map(
      ([args]) => (args as { data: { eventKey: string; kind: string } }).data,
    );
    expect(keys.map((data) => data.kind)).toEqual(["RESERVATION_DUE", "RESERVATION_DUE"]);
    expect(keys.map((data) => data.eventKey)).toEqual([
      `RESERVATION_DUE:reminder:g1:${dueAt.toISOString()}`,
      `RESERVATION_DUE:g1:${dueAt.toISOString()}`,
    ]);
    expect(new Set(keys.map((data) => data.eventKey)).size).toBe(2);
    info.mockRestore();
  });
});

/**
 * Story 5.4 (FR-31): the two new lines of the seam. An edit has no `from`/`to`
 * and carries names, not values; a deletion carries the transition and the
 * holder. The four lines of 5.2/5.3 keep their shape (their tests above parse
 * them unchanged).
 */
describe("recordGiftEvent of Story 5.4", () => {
  const at = new Date("2026-11-20T10:00:00.000Z");

  it("writes an edited line without a transition and without values", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    recordGiftEvent({
      giftId: "g1",
      actorId: "u1",
      at,
      kind: "GIFT_EDITED",
      fields: ["title", "price"],
    });

    // Exactly one line, in the fixed key order, and no title or price value.
    expect(info.mock.calls).toHaveLength(1);
    expect(info.mock.calls[0]?.[0]).toBe(
      '{"event":"gift.edited","giftId":"g1","actorId":"u1","fields":["title","price"],"at":"2026-11-20T10:00:00.000Z"}',
    );
    info.mockRestore();
  });

  it("writes a deleted line with the transition and the holder", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    recordGiftEvent({
      giftId: "g1",
      actorId: "u1",
      from: "RESERVED",
      to: "OPEN",
      at,
      kind: "GIFT_DELETED",
      recipientId: "u2",
    });

    expect(info.mock.calls).toHaveLength(1);
    expect(info.mock.calls[0]?.[0]).toBe(
      '{"event":"gift.deleted","giftId":"g1","actorId":"u1","from":"RESERVED","to":"OPEN","recipientId":"u2","at":"2026-11-20T10:00:00.000Z"}',
    );
    info.mockRestore();
  });

  it("keeps the three lines of 5.2/5.3 on `gift.status` and without the new keys", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const transitions = [
      ["RESERVATION_RELEASED_BY_HOLDER", "RESERVED", "OPEN"],
      ["WISH_CLOSED", "OPEN", "CLOSED"],
      ["WISH_REOPENED", "CLOSED", "RESERVED"],
    ] as const;
    for (const [kind, from, to] of transitions) {
      recordGiftEvent({ giftId: "g1", actorId: "u1", from, to, at, kind });
    }

    expect(info.mock.calls.map((call) => JSON.parse(String(call[0])))).toEqual(
      transitions.map(([, from, to]) => ({
        event: "gift.status",
        giftId: "g1",
        actorId: "u1",
        from,
        to,
        at: "2026-11-20T10:00:00.000Z",
      })),
    );
    info.mockRestore();
  });
});

describe("runGiftStatusTransaction", () => {
  const at = new Date("2026-11-19T12:00:00.000Z");

  it("reports the transition only after the transaction committed", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    transaction.mockImplementation(async function commit(run) {
      const outcome = await run(transactionClient());
      // The line is still absent while the transaction has not returned.
      expect(info).not.toHaveBeenCalled();
      return outcome;
    });

    const outcome = await runGiftStatusTransaction(function close(service) {
      return service.closeGift("g1", "u1", "OPEN", at);
    });

    expect(outcome).toBe("success");
    expectOneAuditLine(info.mock.calls, {
      event: "gift.status",
      giftId: "g1",
      actorId: "u1",
      from: "OPEN",
      to: "CLOSED",
      at: "2026-11-19T12:00:00.000Z",
    });
    info.mockRestore();
  });

  it("writes no audit line when the transaction rolls back after the CAS", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    transaction.mockImplementation(async function rollback(run) {
      await run(transactionClient());
      throw new Error("rollback");
    });

    await expect(
      runGiftStatusTransaction(function close(service) {
        return service.closeGift("g1", "u1", "RESERVED", at);
      }),
    ).rejects.toThrow("rollback");

    // The CAS did run and matched a row, but the transaction never committed.
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(info).not.toHaveBeenCalled();
    info.mockRestore();
  });

  it("does not report a lost CAS", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    updateMany.mockResolvedValue({ count: 0 });
    transaction.mockImplementation(async function commit(run) {
      return run(transactionClient());
    });

    const outcome = await runGiftStatusTransaction(function release(service) {
      return service.releaseReservationByHolder("g1", "u2", at);
    });

    expect(outcome).toBe("lost");
    expect(info).not.toHaveBeenCalled();
    info.mockRestore();
  });
});

describe("processWishExpiry", () => {
  const now = new Date("2026-11-10T12:00:00.000Z");

  it("archives an open wish only after the owner's local day has passed", async () => {
    findMany.mockResolvedValue([
      {
        id: "yesterday",
        expiresOn: new Date("2026-11-09T00:00:00.000Z"),
        list: { owner: { timeZone: "UTC" } },
      },
      {
        id: "today",
        expiresOn: new Date("2026-11-10T00:00:00.000Z"),
        list: { owner: { timeZone: "UTC" } },
      },
      {
        id: "minsk-still-today",
        expiresOn: new Date("2026-11-10T00:00:00.000Z"),
        list: { owner: { timeZone: "Europe/Minsk" } },
      },
    ]);

    await expect(processWishExpiry(now, expiryClient())).resolves.toEqual({
      archived: 1,
      failed: 0,
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "OPEN",
          archivedAt: null,
          expiresOn: { not: null, lt: new Date("2026-11-11T00:00:00.000Z") },
        },
        take: 500,
      }),
    );
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: "yesterday",
        status: "OPEN",
        archivedAt: null,
        expiresOn: new Date("2026-11-09T00:00:00.000Z"),
      },
      data: { archivedAt: now },
    });
  });

  it("archives on the next local day, including a zone that is already tomorrow", async () => {
    const late = new Date("2026-11-10T22:00:00.000Z");
    findMany.mockResolvedValue([
      {
        id: "minsk",
        expiresOn: new Date("2026-11-10T00:00:00.000Z"),
        list: { owner: { timeZone: "Europe/Minsk" } },
      },
    ]);

    await expect(processWishExpiry(late, expiryClient())).resolves.toEqual({
      archived: 1,
      failed: 0,
    });
  });

  it("does not count a CAS that lost the race", async () => {
    findMany.mockResolvedValue([
      {
        id: "g1",
        expiresOn: new Date("2026-11-09T00:00:00.000Z"),
        list: { owner: { timeZone: null } },
      },
    ]);
    updateMany.mockResolvedValue({ count: 0 });

    await expect(processWishExpiry(now, expiryClient())).resolves.toEqual({
      archived: 0,
      failed: 0,
    });
  });

  it("compares expiresOn in the CAS so a date moved forward keeps the wish", async () => {
    const read = new Date("2026-11-09T00:00:00.000Z");
    findMany.mockResolvedValue([
      { id: "g1", expiresOn: read, list: { owner: { timeZone: "UTC" } } },
    ]);
    updateMany.mockResolvedValue({ count: 0 });

    await expect(processWishExpiry(now, expiryClient())).resolves.toEqual({
      archived: 0,
      failed: 0,
    });
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ expiresOn: read }),
      }),
    );
  });

  it("logs a failing row by id and error name, counts it and processes the rest", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const old = new Date("2026-11-01T00:00:00.000Z");
    findMany.mockResolvedValue([
      { id: "bad", expiresOn: old, list: { owner: { timeZone: "UTC" } } },
      { id: "good", expiresOn: old, list: { owner: { timeZone: "UTC" } } },
    ]);
    updateMany.mockRejectedValueOnce(new Error("secret title")).mockResolvedValueOnce({ count: 1 });

    await expect(processWishExpiry(now, expiryClient())).resolves.toEqual({
      archived: 1,
      failed: 1,
    });
    expect(updateMany).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(spy.mock.calls);
    expect(logged).toContain("bad");
    expect(logged).not.toContain("secret title");
    spy.mockRestore();
  });

  it("pages by id so the row right after a batch boundary is archived", async () => {
    const old = new Date("2026-11-01T00:00:00.000Z");
    const all = Array.from({ length: 501 }, (_, index) => ({
      id: `g${String(index).padStart(4, "0")}`,
      expiresOn: old,
      list: { owner: { timeZone: "UTC" } },
    }));
    findMany.mockImplementation(
      ({ where, take }: { where: { id?: { gt: string } }; take: number }) =>
        Promise.resolve(
          all.filter((row) => where.id === undefined || row.id > where.id.gt).slice(0, take),
        ),
    );

    await expect(processWishExpiry(now, expiryClient())).resolves.toEqual({
      archived: 501,
      failed: 0,
    });
    expect(findMany).toHaveBeenCalledTimes(2);
    expect(findMany.mock.calls[1]?.[0]).toMatchObject({
      where: { id: { gt: "g0499" } },
    });
    expect(findMany.mock.calls[1]?.[0]).not.toHaveProperty("cursor");
  });

  it("changes nothing when there is no candidate", async () => {
    findMany.mockResolvedValue([]);
    await expect(processWishExpiry(now, expiryClient())).resolves.toEqual({
      archived: 0,
      failed: 0,
    });
    expect(updateMany).not.toHaveBeenCalled();
  });
});

describe("restoreFromArchive", () => {
  const now = new Date("2026-11-10T12:00:00.000Z");

  it("clears the archive and replaces the date in one update", async () => {
    await expect(
      restoreFromArchive(
        { giftId: "g1", ownerId: "u1", expiresOn: null, timeZone: "UTC", now },
        expiryClient(),
      ),
    ).resolves.toBe("ok");

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: "g1",
        status: "OPEN",
        NOT: { archivedAt: null },
        list: { ownerId: "u1" },
      },
      data: { archivedAt: null, expiresOn: null },
    });
  });

  it("refuses a past day before writing", async () => {
    await expect(
      restoreFromArchive(
        {
          giftId: "g1",
          ownerId: "u1",
          expiresOn: "2026-11-09",
          timeZone: "UTC",
          now,
        },
        expiryClient(),
      ),
    ).resolves.toBe("past");
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("reports a miss when the wish is not the owner's archived open row", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    await expect(
      restoreFromArchive(
        {
          giftId: "g1",
          ownerId: "u1",
          expiresOn: "2026-11-10",
          timeZone: "UTC",
          now,
        },
        expiryClient(),
      ),
    ).resolves.toBe("missing");
  });
});

/**
 * Story 5.6 (AD-9): the four CAS writes of the reservation cycle. Every one is a
 * full-predicate write, so a stale or concurrently changed row loses and leaves
 * neither data nor an audit line.
 */
describe("the Story 5.6 timer CAS writes", () => {
  const at = new Date("2026-11-20T12:00:00.000Z");
  const GIVER_WINDOW_MS = 72 * 60 * 60 * 1000;
  const OWNER_WINDOW_MS = 168 * 60 * 60 * 1000;

  it("moves ACTIVE to AWAITING_GIVER with the deadline predicate and a system event", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const outcome = await giftStatusTransaction(transactionClient()).moveReservationToAwaitingGiver(
      "g1",
      at,
    );

    expect(outcome).toBe("success");
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: "g1",
        status: "RESERVED",
        archivedAt: null,
        reservationPhase: "ACTIVE",
        reservationDueAt: { lte: at },
      },
      data: { reservationPhase: "AWAITING_GIVER", reservationPhaseAt: at },
    });
    expect(createMany).toHaveBeenCalledExactlyOnceWith({
      skipDuplicates: true,
      data: expect.objectContaining({
        kind: "RESERVATION_DUE", recipientId: "u2", emailRequired: true,
      }),
    });
    expectOneAuditLine(info.mock.calls, {
      event: "gift.reservation.giver-deadline-passed",
      giftId: "g1",
      actorId: null,
      from: "RESERVED",
      to: "RESERVED",
      at: at.toISOString(),
    });
    info.mockRestore();
  });

  it("moves AWAITING_GIVER to AWAITING_OWNER only after the 72-hour window", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const outcome = await giftStatusTransaction(transactionClient()).moveReservationToAwaitingOwner(
      "g1",
      at,
    );

    expect(outcome).toBe("success");
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: "g1",
        status: "RESERVED",
        archivedAt: null,
        reservationPhase: "AWAITING_GIVER",
        reservationPhaseAt: { lte: new Date(at.getTime() - GIVER_WINDOW_MS) },
      },
      data: { reservationPhase: "AWAITING_OWNER", reservationPhaseAt: at },
    });
    // CLE-124: the owner is never asked, so the timer writes no row here.
    expect(createMany).not.toHaveBeenCalled();
    expectOneAuditLine(info.mock.calls, {
      event: "gift.reservation.owner-window-started",
      giftId: "g1",
      actorId: null,
      from: "RESERVED",
      to: "RESERVED",
      at: at.toISOString(),
    });
    info.mockRestore();
  });

  it("releases AWAITING_OWNER or GIVEN when the deadline is 168 hours old, with the 5.2 clear and no `bought` in the CAS", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const outcome = await giftStatusTransaction(transactionClient()).releaseReservationByExpiry(
      "g1",
      at,
    );

    expect(outcome).toBe("success");
    // CLE-124: only the holder is notified about the automatic release.
    expect(createMany).toHaveBeenCalledExactlyOnceWith({
      skipDuplicates: true,
      data: expect.objectContaining({
        kind: "RESERVATION_AUTO_RELEASE", recipientId: "u2", emailRequired: true,
      }),
    });
    // The holder and reservation snapshot come from the transition transaction.
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "g1" },
      select: expect.objectContaining({ status: true, reservedById: true, reservedAt: true }),
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: "g1",
        status: "RESERVED",
        archivedAt: null,
        // CLE-124/S9b-1: both phases of the release, and no `bought` condition.
        reservationPhase: { in: ["AWAITING_OWNER", "GIVEN"] },
        reservedAt,
        reservationDueAt: {
          equals: reservationDueAt,
          lte: new Date(at.getTime() - OWNER_WINDOW_MS),
        },
        reservationPhaseAt: { lt: at },
      },
      data: RESERVATION_RELEASE_DATA,
    });
    expectOneAuditLine(info.mock.calls, {
      event: "gift.reservation.released-by-expiry",
      giftId: "g1",
      actorId: null,
      from: "RESERVED",
      to: "OPEN",
      recipientId: "u2",
      at: at.toISOString(),
    });
    info.mockRestore();
  });

  it.each([null, { status: "OPEN", reservedById: null }])(
    "writes and logs nothing when the expiry finds %o instead of a live reservation",
    async (row) => {
      const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
      findUnique.mockResolvedValue(row);

      await expect(
        giftStatusTransaction(transactionClient()).releaseReservationByExpiry("g1", at),
      ).resolves.toBe("lost");

      expect(updateMany).not.toHaveBeenCalled();
      expect(info).not.toHaveBeenCalled();
      info.mockRestore();
    },
  );

  /** An anomalous `RESERVED` row without a holder still reports its transition. */
  it("reports the expiry without a recipient for a RESERVED row that carries no holder", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    findUnique.mockResolvedValue({ status: "RESERVED", reservedById: null });

    await expect(
      giftStatusTransaction(transactionClient()).releaseReservationByExpiry("g1", at),
    ).resolves.toBe("success");

    expectOneAuditLine(info.mock.calls, {
      event: "gift.reservation.released-by-expiry",
      giftId: "g1",
      actorId: null,
      from: "RESERVED",
      to: "OPEN",
      at: at.toISOString(),
    });
    info.mockRestore();
  });

  it.each([0, 2])(
    "writes and logs nothing when any of the three CAS writes touches %i rows",
    async (count) => {
      const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
      updateMany.mockResolvedValue({ count });
      const service = giftStatusTransaction(transactionClient());

      await expect(service.moveReservationToAwaitingGiver("g1", at)).resolves.toBe("lost");
      await expect(service.moveReservationToAwaitingOwner("g1", at)).resolves.toBe("lost");
      await expect(service.releaseReservationByExpiry("g1", at)).resolves.toBe("lost");

      expect(updateMany).toHaveBeenCalledTimes(3);
      expect(createMany).not.toHaveBeenCalled();
      expect(info).not.toHaveBeenCalled();
      info.mockRestore();
    },
  );
});

/**
 * CLE-124: a wish's reservation is a surprise for its owner. No transition
 * writes a notification row addressed to the owner; the holder's rows, the
 * audit lines and the transitions themselves stay as they were.
 */
describe("CLE-124: the owner is never notified about a reservation", () => {
  const at = new Date("2026-11-24T12:00:00.000Z");

  it("writes no row at all on reserve, the holder's release and the owner phase", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const service = giftStatusTransaction(transactionClient());

    await expect(service.reserveGift("g1", {
      reservedById: "u2",
      reservedAt,
      titleSnapshotOnReserve: "Плед",
      reservationDueAt: at,
      reservationTimeZone: "UTC",
      reservationPhaseAt: at,
      holderVisibleToOthers: true,
    })).resolves.toBe("success");
    await expect(service.releaseReservationByHolder("g1", "u2", at)).resolves.toBe("success");
    await expect(service.moveReservationToAwaitingOwner("g1", at)).resolves.toBe("success");

    // u1 owns g1 and u2 holds it, so an owner row would carry `recipientId: "u1"`.
    expect(createMany).not.toHaveBeenCalled();
    // The transitions themselves still happen and are still audited.
    expect(updateMany).toHaveBeenCalledTimes(3);
    expect(info).toHaveBeenCalledTimes(2);
    info.mockRestore();
  });

  it("keeps the holder's automatic-release row and writes none for the owner", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await expect(
      giftStatusTransaction(transactionClient()).releaseReservationByExpiry("g1", at),
    ).resolves.toBe("success");

    expect(createMany.mock.calls.map(([args]) => {
      const row = args.data as { kind: string; recipientId: string };
      return `${row.kind}:${row.recipientId}`;
    })).toEqual(["RESERVATION_AUTO_RELEASE:u2"]);
    info.mockRestore();
  });

  /**
   * The whole cycle in one place: the holder gets the deadline reminder and the
   * automatic release, and the owner gets nothing at any step (D-49).
   */
  it("writes exactly the holder's two rows over the whole cycle and nothing for the owner", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const service = giftStatusTransaction(transactionClient());

    await expect(service.moveReservationToAwaitingGiver("g1", at)).resolves.toBe("success");
    await expect(service.moveReservationToAwaitingOwner("g1", at)).resolves.toBe("success");
    await expect(service.releaseReservationByExpiry("g1", at)).resolves.toBe("success");

    // u1 owns g1 and u2 holds it: an owner row would carry `recipientId: "u1"`.
    expect(createMany.mock.calls.map(([args]) => {
      const row = args.data as { kind: string; recipientId: string };
      return `${row.kind}:${row.recipientId}`;
    })).toEqual(["RESERVATION_DUE:u2", "RESERVATION_AUTO_RELEASE:u2"]);
    info.mockRestore();
  });
});

/**
 * Story 5.6: the timer transitions of 5.4's seam. The four kinds are told apart
 * by the event name (5.4's rule), and a timer transition has `actorId: null`.
 */
describe("recordGiftEvent of Story 5.6", () => {
  const at = new Date("2026-11-20T12:00:00.000Z");

  it("writes the three timer lines with a null actor and no names", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    recordGiftEvent({
      giftId: "g1",
      actorId: null,
      from: "RESERVED",
      to: "RESERVED",
      at,
      kind: "RESERVATION_GIVER_DEADLINE_PASSED",
    });
    recordGiftEvent({
      giftId: "g1",
      actorId: null,
      from: "RESERVED",
      to: "RESERVED",
      at,
      kind: "RESERVATION_OWNER_WINDOW_STARTED",
    });
    recordGiftEvent({
      giftId: "g1",
      actorId: null,
      from: "RESERVED",
      to: "OPEN",
      recipientId: "u2",
      at,
      kind: "RESERVATION_RELEASED_BY_EXPIRY",
    });

    expect(info.mock.calls.map((call) => String(call[0]))).toEqual([
      '{"event":"gift.reservation.giver-deadline-passed","giftId":"g1","actorId":null,"from":"RESERVED","to":"RESERVED","at":"2026-11-20T12:00:00.000Z"}',
      '{"event":"gift.reservation.owner-window-started","giftId":"g1","actorId":null,"from":"RESERVED","to":"RESERVED","at":"2026-11-20T12:00:00.000Z"}',
      '{"event":"gift.reservation.released-by-expiry","giftId":"g1","actorId":null,"from":"RESERVED","to":"OPEN","recipientId":"u2","at":"2026-11-20T12:00:00.000Z"}',
    ]);
    info.mockRestore();
  });
});

/**
 * Story 5.6 (AD-9, ARCH-A15): one hourly run over three steps, one `now`, one
 * transaction per row. The candidates come from the same predicates the CAS
 * carries, so a row moved by step 1 has `phaseAt = now` and is not a candidate of
 * step 2 in the same run.
 */
describe("processReservationTimers", () => {
  const now = new Date("2026-11-20T12:00:00.000Z");
  const GIVER_WINDOW_MS = 72 * 60 * 60 * 1000;
  const OWNER_WINDOW_MS = 168 * 60 * 60 * 1000;

  beforeEach(commitEachTransaction);

  type FindArgs = {
    where: {
      reservationPhase?: string | { in: string[] };
      reservationDueAt?: { lte?: Date; gt?: Date };
      id?: { gt: string };
    };
    take: number;
  };

  /** Steps 1, 2, the release and the reminder: the phase list of each read. */
  function candidateKey(phase: string | { in: string[] } | undefined): string {
    if (typeof phase === "string") return phase;
    if (phase === undefined) return "";
    return phase.in.join("|");
  }

  function isReminderRead(where: FindArgs["where"]): boolean {
    return where.reservationDueAt?.gt !== undefined;
  }

  function candidatesByPhase(
    byPhase: Record<string, { id: string }[]>,
    reminders: { id: string }[] = [],
  ): void {
    findMany.mockImplementation(({ where }: FindArgs) =>
      Promise.resolve(
        isReminderRead(where)
          ? reminders
          : (byPhase[candidateKey(where.reservationPhase)] ?? []),
      ),
    );
  }

  it("runs the three transitions and the reminder in AD-9 order with one now and one event per row", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    candidatesByPhase({
      ACTIVE: [{ id: "a" }],
      AWAITING_GIVER: [{ id: "b" }],
      "AWAITING_OWNER|GIVEN": [{ id: "c" }],
    });

    await expect(processReservationTimers(now, timerClient())).resolves.toEqual({
      expiredToGiver: 1,
      toAwaitingOwner: 1,
      released: 1,
      reminded: 0,
      failed: 0,
    });

    expect(findMany.mock.calls.map(([args]) => (args as FindArgs).where.reservationPhase)).toEqual([
      "ACTIVE",
      "AWAITING_GIVER",
      { in: ["AWAITING_OWNER", "GIVEN"] },
      "ACTIVE",
    ]);
    for (const [args] of findMany.mock.calls) {
      expect(args).toMatchObject({
        where: { status: "RESERVED", archivedAt: null },
        select: { id: true },
        orderBy: { id: "asc" },
        take: 500,
      });
    }
    // The reminder read is the only one that bounds the deadline from both sides.
    expect((findMany.mock.calls[3]?.[0] as FindArgs).where.reservationDueAt).toEqual({
      gt: now,
      lte: new Date(now.getTime() + 48 * 60 * 60 * 1000),
    });

    expect(updateMany.mock.calls.map(([args]) => (args as { where: unknown }).where)).toEqual([
      {
        id: "a",
        status: "RESERVED",
        archivedAt: null,
        reservationPhase: "ACTIVE",
        reservationDueAt: { lte: now },
      },
      {
        id: "b",
        status: "RESERVED",
        archivedAt: null,
        reservationPhase: "AWAITING_GIVER",
        reservationPhaseAt: { lte: new Date(now.getTime() - GIVER_WINDOW_MS) },
      },
      {
        id: "c",
        status: "RESERVED",
        archivedAt: null,
        reservationPhase: { in: ["AWAITING_OWNER", "GIVEN"] },
        reservedAt,
        reservationDueAt: {
          equals: reservationDueAt,
          lte: new Date(now.getTime() - OWNER_WINDOW_MS),
        },
        reservationPhaseAt: { lt: now },
      },
    ]);
    expect((updateMany.mock.calls[2]?.[0] as { data: unknown }).data).toBe(
      RESERVATION_RELEASE_DATA,
    );

    expect(info.mock.calls.map((call) => JSON.parse(String(call[0])))).toEqual([
      {
        event: "gift.reservation.giver-deadline-passed",
        giftId: "a",
        actorId: null,
        from: "RESERVED",
        to: "RESERVED",
        at: now.toISOString(),
      },
      {
        event: "gift.reservation.owner-window-started",
        giftId: "b",
        actorId: null,
        from: "RESERVED",
        to: "RESERVED",
        at: now.toISOString(),
      },
      {
        event: "gift.reservation.released-by-expiry",
        giftId: "c",
        actorId: null,
        from: "RESERVED",
        to: "OPEN",
        recipientId: "u2",
        at: now.toISOString(),
      },
    ]);
    info.mockRestore();
  });

  it("reads live RESERVED candidates: steps 1–2 by phase, step 3 from AWAITING_OWNER or GIVEN, then the reminder", async () => {
    findMany.mockResolvedValue([]);

    await expect(processReservationTimers(now, timerClient())).resolves.toEqual({
      expiredToGiver: 0,
      toAwaitingOwner: 0,
      released: 0,
      reminded: 0,
      failed: 0,
    });

    expect(findMany).toHaveBeenCalledTimes(4);
    const phases = findMany.mock.calls.map(([args]) => (args as FindArgs).where.reservationPhase);
    expect(phases).toEqual(["ACTIVE", "AWAITING_GIVER", { in: ["AWAITING_OWNER", "GIVEN"] }, "ACTIVE"]);
    for (const [args] of findMany.mock.calls) {
      expect(args).toMatchObject({ where: { status: "RESERVED", archivedAt: null } });
    }
    expect(updateMany).not.toHaveBeenCalled();
  });

  /** CLE-124/D-49: the release window is counted from the deadline, not the phase. */
  it("selects step 3 by the deadline and keeps a phase started in this run out", async () => {
    findMany.mockResolvedValue([]);

    await processReservationTimers(now, timerClient());

    expect(findMany.mock.calls[2]?.[0]).toMatchObject({
      where: {
        status: "RESERVED",
        archivedAt: null,
        reservationPhase: { in: ["AWAITING_OWNER", "GIVEN"] },
        reservationDueAt: { lte: new Date(now.getTime() - OWNER_WINDOW_MS) },
        reservationPhaseAt: { lt: now },
      },
    });
  });

  it("releases a GIVEN candidate too and writes only the holder's row", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    candidatesByPhase({ "AWAITING_OWNER|GIVEN": [{ id: "given" }] });

    await expect(processReservationTimers(now, timerClient())).resolves.toEqual({
      expiredToGiver: 0,
      toAwaitingOwner: 0,
      released: 1,
      reminded: 0,
      failed: 0,
    });

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "given",
          status: "RESERVED",
          reservationPhase: { in: ["AWAITING_OWNER", "GIVEN"] },
        }),
        data: RESERVATION_RELEASE_DATA,
      }),
    );
    // CLE-124/S9b-1: only the holder is told, the owner never is (D-49).
    expect(createMany.mock.calls.map(([args]) => {
      const row = args.data as { kind: string; recipientId: string };
      return `${row.kind}:${row.recipientId}`;
    })).toEqual(["RESERVATION_AUTO_RELEASE:u2"]);
    info.mockRestore();
  });

  it("finds nothing and reports zeros when the run repeats with the same now", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    candidatesByPhase({ ACTIVE: [{ id: "a" }] });

    await processReservationTimers(now, timerClient());
    expect(info).toHaveBeenCalledTimes(1);

    // Step 1 moved the row to AWAITING_GIVER with `phaseAt = now`, so no step of
    // a second run matches it anymore.
    candidatesByPhase({});
    await expect(processReservationTimers(now, timerClient())).resolves.toEqual({
      expiredToGiver: 0,
      toAwaitingOwner: 0,
      released: 0,
      reminded: 0,
      failed: 0,
    });
    expect(info).toHaveBeenCalledTimes(1);
    info.mockRestore();
  });

  it("counts a failing row, logs only its id and error code and processes the rest", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    candidatesByPhase({ ACTIVE: [{ id: "bad" }, { id: "good" }] });
    updateMany
      .mockRejectedValueOnce(Object.assign(new Error("secret title"), { code: "P2024" }))
      .mockResolvedValueOnce({ count: 1 });

    await expect(processReservationTimers(now, timerClient())).resolves.toEqual({
      expiredToGiver: 1,
      toAwaitingOwner: 0,
      released: 0,
      reminded: 0,
      failed: 1,
    });

    expect(updateMany).toHaveBeenCalledTimes(2);
    expect(info).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(error.mock.calls);
    expect(logged).toContain("bad");
    expect(logged).toContain("P2024");
    expect(logged).not.toContain("secret title");
    info.mockRestore();
    error.mockRestore();
  });

  it("pages by id in batches of 500", async () => {
    const rows = Array.from({ length: 501 }, (_, index) => ({
      id: `g${String(index).padStart(4, "0")}`,
    }));
    findMany.mockImplementation(({ where, take }: FindArgs) => {
      if (where.reservationPhase !== "ACTIVE") return Promise.resolve([]);
      // CLE-124/S9b-2: the reminder read has the same phase but a bounded deadline.
      if (where.reservationDueAt?.gt !== undefined) return Promise.resolve([]);
      const after = where.id?.gt;
      return Promise.resolve(
        rows.filter((row) => after === undefined || row.id > after).slice(0, take),
      );
    });

    await expect(processReservationTimers(now, timerClient())).resolves.toMatchObject({
      expiredToGiver: 501,
      reminded: 0,
      failed: 0,
    });

    const activeCalls = findMany.mock.calls.filter(
      ([args]) => {
        const where = (args as FindArgs).where;
        return where.reservationPhase === "ACTIVE" && where.reservationDueAt?.gt === undefined;
      },
    );
    expect(activeCalls).toHaveLength(2);
    expect(activeCalls[1]?.[0]).toMatchObject({ where: { id: { gt: "g0499" } }, take: 500 });
    expect(updateMany).toHaveBeenCalledTimes(501);
  });
});
