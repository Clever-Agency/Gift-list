import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { Prisma, PrismaClient } from "@/db/generated/client";
import { RESERVATION_RELEASE_DATA } from "@/domain/gift-status";
import { giftStatusTransaction, processWishExpiry, restoreFromArchive } from "./gift-status-store";

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
  updateMany.mockResolvedValue({ count: 1 });
});

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
    updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
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

    await expect(processWishExpiry(now, expiryClient())).resolves.toEqual({ archived: 1 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "OPEN", archivedAt: null, expiresOn: { not: null } },
      }),
    );
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "yesterday", status: "OPEN", archivedAt: null },
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

    await expect(processWishExpiry(late, expiryClient())).resolves.toEqual({ archived: 1 });
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

    await expect(processWishExpiry(now, expiryClient())).resolves.toEqual({ archived: 0 });
  });

  it("changes nothing when there is no candidate", async () => {
    findMany.mockResolvedValue([]);
    await expect(processWishExpiry(now, expiryClient())).resolves.toEqual({ archived: 0 });
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
        { giftId: "g1", ownerId: "u1", expiresOn: "2026-11-09", timeZone: "UTC", now },
        expiryClient(),
      ),
    ).resolves.toBe("past");
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("reports a miss when the wish is not the owner's archived open row", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    await expect(
      restoreFromArchive(
        { giftId: "g1", ownerId: "u1", expiresOn: "2026-11-10", timeZone: "UTC", now },
        expiryClient(),
      ),
    ).resolves.toBe("missing");
  });
});
