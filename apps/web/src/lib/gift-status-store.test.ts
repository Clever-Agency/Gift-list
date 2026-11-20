import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { transaction } = vi.hoisted(() => ({ transaction: vi.fn() }));

vi.mock("@/db/client", () => ({ prisma: { $transaction: transaction } }));

import type { Prisma, PrismaClient } from "@/db/generated/client";
import { RESERVATION_RELEASE_DATA } from "@/domain/gift-status";
import {
  giftStatusTransaction,
  processWishExpiry,
  recordGiftEvent,
  restoreFromArchive,
  runGiftStatusTransaction,
} from "./gift-status-store";

const updateMany = vi.fn();
const findMany = vi.fn();

function transactionClient(): Prisma.TransactionClient {
  return { gift: { updateMany } } as unknown as Prisma.TransactionClient;
}

function expiryClient(): PrismaClient {
  return { gift: { findMany, updateMany } } as unknown as PrismaClient;
}

beforeEach(() => {
  updateMany.mockReset();
  findMany.mockReset();
  transaction.mockReset();
  updateMany.mockResolvedValue({ count: 1 });
});

/** NFR-6: one audit line per successful transition, none on a lost CAS. */
function expectOneAuditLine(
  calls: readonly (readonly unknown[])[],
  expected: Record<string, string>,
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
      holderVisibleToOwner: false,
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
      where: { id: "g1", status: "RESERVED", reservedById: "u2" },
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
    info.mockRestore();
  });

  it("lets the owner release with the ownership predicate and logs one audit line", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const at = new Date("2026-11-19T11:30:00.000Z");

    const outcome = await giftStatusTransaction(transactionClient()).releaseReservationByOwner(
      "g1",
      "u1",
      at,
    );

    expect(outcome).toBe("success");
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "g1", status: "RESERVED", list: { ownerId: "u1" } },
      data: RESERVATION_RELEASE_DATA,
    });
    expectOneAuditLine(info.mock.calls, {
      event: "gift.status",
      giftId: "g1",
      actorId: "u1",
      from: "RESERVED",
      to: "OPEN",
      at: "2026-11-19T11:30:00.000Z",
    });
    info.mockRestore();
  });

  it.each(["releaseReservationByHolder", "releaseReservationByOwner"] as const)(
    "writes and logs nothing when %s loses the CAS",
    async (method) => {
      const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
      updateMany.mockResolvedValue({ count: 0 });

      const outcome = await giftStatusTransaction(transactionClient())[method](
        "g1",
        "u2",
        new Date("2026-11-19T10:00:00.000Z"),
      );

      expect(outcome).toBe("lost");
      expect(updateMany).toHaveBeenCalledTimes(1);
      expect(info).not.toHaveBeenCalled();
      info.mockRestore();
    },
  );

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
      "OPEN",
      at,
    );

    expect(outcome).toBe("lost");
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
    expect(info).not.toHaveBeenCalled();
    info.mockRestore();
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

  it("extends with the holder predicate and the extendable phases in one CAS", async () => {
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
        reservationPhase: { in: ["ACTIVE", "AWAITING_GIVER", "AWAITING_OWNER"] },
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

  it("writes only the two toggles, so the phase, its moment and bought stay", async () => {
    const outcome = await giftStatusTransaction(transactionClient()).setReservationVisibility(
      "g1",
      actorId,
      { holderVisibleToOwner: true, holderVisibleToOthers: false },
    );

    expect(outcome).toBe("success");
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "g1", status: "RESERVED", reservedById: actorId },
      data: { holderVisibleToOwner: true, holderVisibleToOthers: false },
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
        holderVisibleToOwner: false,
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
      holderVisibleToOwner: true,
      holderVisibleToOthers: true,
    });

    expect(info).not.toHaveBeenCalled();
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

  it("keeps the four lines of 5.2/5.3 on `gift.status` and without the new keys", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const transitions = [
      ["RESERVATION_RELEASED_BY_HOLDER", "RESERVED", "OPEN"],
      ["RESERVATION_RELEASED_BY_OWNER", "RESERVED", "OPEN"],
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
