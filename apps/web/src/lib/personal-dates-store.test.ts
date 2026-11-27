import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  transaction,
  findMany,
  findFirst,
  updateMany,
  deleteMany,
  count,
  create,
  executeRaw,
} = vi.hoisted(() => ({
  transaction: vi.fn(),
  findMany: vi.fn(),
  findFirst: vi.fn(),
  updateMany: vi.fn(),
  deleteMany: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
  executeRaw: vi.fn(),
}));

const tx = {
  $executeRaw: executeRaw,
  userDate: { count, create },
};

vi.mock("@/db/client", () => ({
  prisma: {
    $transaction: transaction,
    userDate: { findMany, findFirst, updateMany, deleteMany },
  },
}));

import type { PersonalDateCreateBody } from "@gift-list/contracts";
import {
  createPersonalDate,
  deletePersonalDate,
  readPersonalDates,
  updatePersonalDate,
} from "./personal-dates-store";

const row = {
  id: "d1",
  kind: "CUSTOM" as const,
  title: "Годовщина",
  day: 14,
  month: 6,
  year: 2020,
  visibility: "FRIENDS" as const,
  yearVisibility: "ONLY_ME" as const,
  createdAt: new Date("2026-11-01T00:00:00.000Z"),
};

const input: PersonalDateCreateBody = {
  title: "Годовщина",
  day: 14,
  month: 6,
  year: 2020,
  visibility: "FRIENDS",
  yearVisibility: "ONLY_ME",
};

beforeEach(() => {
  transaction.mockReset();
  findMany.mockReset();
  findFirst.mockReset();
  updateMany.mockReset();
  deleteMany.mockReset();
  count.mockReset();
  create.mockReset();
  executeRaw.mockReset();

  transaction.mockImplementation(
    async function runInTransaction(work: (client: typeof tx) => Promise<unknown>) {
      return work(tx);
    },
  );
  findMany.mockResolvedValue([]);
  findFirst.mockResolvedValue(null);
  updateMany.mockResolvedValue({ count: 1 });
  deleteMany.mockResolvedValue({ count: 1 });
  count.mockResolvedValue(0);
  create.mockResolvedValue(row);
  executeRaw.mockResolvedValue(0);
});

describe("readPersonalDates", () => {
  it("reads the owner's rows oldest first with every answer field", async () => {
    findMany.mockResolvedValue([row]);

    const dates = await readPersonalDates("u1");

    expect(findMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        kind: true,
        title: true,
        day: true,
        month: true,
        year: true,
        visibility: true,
        yearVisibility: true,
      },
    });
    expect(dates).toEqual([
      {
        id: "d1",
        kind: "CUSTOM",
        title: "Годовщина",
        day: 14,
        month: 6,
        year: 2020,
        visibility: "FRIENDS",
        yearVisibility: "ONLY_ME",
        ownerId: "u1",
      },
    ]);
  });

  it("answers an empty list without inventing rows", async () => {
    await expect(readPersonalDates("u1")).resolves.toEqual([]);
  });
});

describe("createPersonalDate (AD-23: at most ten, atomically)", () => {
  it("locks the user, counts and inserts inside one transaction", async () => {
    count.mockResolvedValue(9);

    const outcome = await createPersonalDate("u1", input);

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(count).toHaveBeenCalledWith({ where: { userId: "u1", kind: "CUSTOM" } });
    expect(create).toHaveBeenCalledWith({
      data: {
        userId: "u1",
        kind: "CUSTOM",
        title: "Годовщина",
        day: 14,
        month: 6,
        year: 2020,
        visibility: "FRIENDS",
        yearVisibility: "ONLY_ME",
      },
      select: expect.objectContaining({ id: true, title: true }),
    });
    // The advisory lock is taken before the count that can be raced.
    expect(executeRaw.mock.invocationCallOrder[0]).toBeLessThan(count.mock.invocationCallOrder[0]!);
    expect(count.mock.invocationCallOrder[0]).toBeLessThan(create.mock.invocationCallOrder[0]!);
    expect(outcome).toEqual({
      ok: true,
      date: expect.objectContaining({ id: "d1", ownerId: "u1" }),
    });
  });

  it("answers limit on the eleventh date and writes nothing", async () => {
    count.mockResolvedValue(10);

    await expect(createPersonalDate("u1", input)).resolves.toEqual({
      ok: false,
      reason: "limit",
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("stores an absent year as null", async () => {
    create.mockResolvedValue({ ...row, year: null });

    await createPersonalDate("u1", { ...input, year: undefined });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ year: null }) }),
    );
  });
});

describe("updatePersonalDate", () => {
  it("answers not-found for a foreign or unknown id and writes nothing", async () => {
    findFirst.mockResolvedValue(null);

    await expect(updatePersonalDate("u2", "d1", { title: "Новое" })).resolves.toEqual({
      ok: false,
      reason: "not-found",
    });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "d1", userId: "u2" } }),
    );
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("refuses a year-only edit that makes the stored day impossible", async () => {
    findFirst.mockResolvedValue({ ...row, day: 29, month: 2, year: null });

    await expect(updatePersonalDate("u1", "d1", { year: 2023 })).resolves.toEqual({
      ok: false,
      reason: "invalid",
      field: "day",
    });
    expect(updateMany).not.toHaveBeenCalled();
    expect(findFirst).toHaveBeenCalledTimes(1);
  });

  it("accepts the same 29 February in a leap year", async () => {
    findFirst
      .mockResolvedValueOnce({ ...row, day: 29, month: 2, year: null })
      .mockResolvedValueOnce({ ...row, day: 29, month: 2, year: 2024 });

    const outcome = await updatePersonalDate("u1", "d1", { year: 2024 });

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "d1", userId: "u1" },
      data: { year: 2024 },
    });
    expect(outcome).toEqual({
      ok: true,
      date: expect.objectContaining({ id: "d1", day: 29, month: 2, year: 2024 }),
    });
  });

  it("changes only the keys the body carried", async () => {
    findFirst.mockResolvedValueOnce(row).mockResolvedValueOnce({ ...row, visibility: "EVERYONE" });

    const outcome = await updatePersonalDate("u1", "d1", { visibility: "EVERYONE" });

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "d1", userId: "u1" },
      data: { visibility: "EVERYONE" },
    });
    expect(outcome.ok).toBe(true);
  });

  it("answers not-found when the row disappears between the read and the write", async () => {
    findFirst.mockResolvedValueOnce(row);
    updateMany.mockResolvedValue({ count: 0 });

    await expect(updatePersonalDate("u1", "d1", { title: "Новое" })).resolves.toEqual({
      ok: false,
      reason: "not-found",
    });
  });
});

describe("deletePersonalDate", () => {
  it("deletes by id and owner, so a foreign row is never touched", async () => {
    await expect(deletePersonalDate("u1", "d1")).resolves.toBe(true);

    expect(deleteMany).toHaveBeenCalledWith({ where: { id: "d1", userId: "u1" } });
  });

  it("answers false when nothing matched", async () => {
    deleteMany.mockResolvedValue({ count: 0 });

    await expect(deletePersonalDate("u2", "d1")).resolves.toBe(false);
  });
});
