import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () => ({ prisma: {} }));

import { GiftStatusService } from "./gift-status";

const { findMany, updateMany } = vi.hoisted(() => ({
  findMany: vi.fn(),
  updateMany: vi.fn(),
}));

function service() {
  return new GiftStatusService({ gift: { findMany, updateMany } } as never);
}

beforeEach(() => {
  findMany.mockReset();
  updateMany.mockReset();
  updateMany.mockResolvedValue({ count: 1 });
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

    await expect(service().processWishExpiry(now)).resolves.toEqual({ archived: 1 });

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

    await expect(service().processWishExpiry(late)).resolves.toEqual({ archived: 1 });
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

    await expect(service().processWishExpiry(now)).resolves.toEqual({ archived: 0 });
  });

  it("changes nothing when there is no candidate", async () => {
    findMany.mockResolvedValue([]);
    await expect(service().processWishExpiry(now)).resolves.toEqual({ archived: 0 });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("asks only for OPEN unarchived rows with a date, so RESERVED and CLOSED stay put", async () => {
    findMany.mockResolvedValue([]);
    await service().processWishExpiry(now);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "OPEN", archivedAt: null, expiresOn: { not: null } },
      }),
    );
  });
});

describe("restoreFromArchive", () => {
  const now = new Date("2026-11-10T12:00:00.000Z");

  it("clears the archive and replaces the date in one update", async () => {
    updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service().restoreFromArchive({
        giftId: "g1",
        ownerId: "u1",
        expiresOn: null,
        timeZone: "UTC",
        now,
      }),
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
      service().restoreFromArchive({
        giftId: "g1",
        ownerId: "u1",
        expiresOn: "2026-11-09",
        timeZone: "UTC",
        now,
      }),
    ).resolves.toBe("past");
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("reports a miss when the wish is not the owner's archived open row", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service().restoreFromArchive({
        giftId: "g1",
        ownerId: "u1",
        expiresOn: "2026-11-10",
        timeZone: "UTC",
        now,
      }),
    ).resolves.toBe("missing");
  });
});
