import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const db = vi.hoisted(() => {
  const tx = {
    $executeRaw: vi.fn(),
    block: { findUnique: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn() },
    subscription: { deleteMany: vi.fn() },
    friendship: { deleteMany: vi.fn() },
    friendshipInvite: { deleteMany: vi.fn() },
  };

  return {
    tx,
    prisma: {
      $transaction: vi.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx)),
      block: { findMany: vi.fn() },
    },
  };
});

vi.mock("@/db/client", () => ({ prisma: db.prisma }));

import { blockUser, unblockUser } from "@/domain/block";
import { blockedPeopleReader, friendshipStore } from "./friendship-store";

beforeEach(() => {
  vi.clearAllMocks();
  db.tx.$executeRaw.mockResolvedValue(1);
  db.tx.block.findUnique.mockResolvedValue(null);
  db.tx.block.createMany.mockResolvedValue({ count: 1 });
  db.tx.block.deleteMany.mockResolvedValue({ count: 0 });
  db.tx.subscription.deleteMany.mockResolvedValue({ count: 0 });
  db.tx.friendship.deleteMany.mockResolvedValue({ count: 0 });
  db.tx.friendshipInvite.deleteMany.mockResolvedValue({ count: 0 });
});

describe("friendshipStore block writes (Story 4.5, AD-10 step 4)", () => {
  it("takes the pair lock first and sweeps the pair inside one transaction", async () => {
    await blockUser({ viewerId: "u1", otherUserId: "u2" }, friendshipStore);

    expect(db.tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(db.tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      db.tx.friendship.deleteMany.mock.invocationCallOrder[0],
    );
    expect(db.tx.friendship.deleteMany).toHaveBeenCalledWith({
      where: { userLowId: "u1", userHighId: "u2" },
    });
    expect(db.tx.friendshipInvite.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { fromUserId: "u1", toUserId: "u2" },
          { fromUserId: "u2", toUserId: "u1" },
        ],
      },
    });
    expect(db.tx.subscription.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { subscriberId: "u1", targetId: "u2" },
          { subscriberId: "u2", targetId: "u1" },
        ],
      },
    });
  });

  it("inserts the block idempotently, directed and without a read-before-write guard", async () => {
    await blockUser({ viewerId: "u1", otherUserId: "u2" }, friendshipStore);

    expect(db.tx.block.findUnique).toHaveBeenCalledWith({
      where: { blockerId_blockedId: { blockerId: "u1", blockedId: "u2" } },
      select: { id: true },
    });
    expect(db.tx.block.createMany).toHaveBeenCalledWith({
      data: [{ blockerId: "u1", blockedId: "u2" }],
      skipDuplicates: true,
    });
  });

  it("reports ALREADY_BLOCKED from the viewer's own row only", async () => {
    db.tx.block.findUnique.mockResolvedValue({ id: "block_1" });

    await expect(
      blockUser({ viewerId: "u1", otherUserId: "u2" }, friendshipStore),
    ).resolves.toEqual({ ok: true, outcome: "ALREADY_BLOCKED" });
  });

  it("deletes exactly one directed block and answers whether it existed", async () => {
    db.tx.block.deleteMany.mockResolvedValue({ count: 1 });

    await expect(
      unblockUser({ viewerId: "u1", otherUserId: "u2" }, friendshipStore),
    ).resolves.toEqual({ ok: true, outcome: "UNBLOCKED" });
    expect(db.tx.block.deleteMany).toHaveBeenCalledWith({
      where: { blockerId: "u1", blockedId: "u2" },
    });

    db.tx.block.deleteMany.mockResolvedValue({ count: 0 });
    await expect(
      unblockUser({ viewerId: "u1", otherUserId: "u2" }, friendshipStore),
    ).resolves.toEqual({ ok: true, outcome: "NOT_BLOCKED" });
    expect(db.tx.friendship.deleteMany).not.toHaveBeenCalled();
  });
});

describe("blockedPeopleReader (Story 4.5.2)", () => {
  it("reads only the viewer's own blocks, newest first, with the row fields", async () => {
    const blockedAt = new Date("2026-11-10T10:00:00.000Z");
    db.prisma.block.findMany.mockResolvedValue([
      { createdAt: blockedAt, blocked: { id: "u2", name: "Анна", nick: "anna" } },
    ]);

    await expect(blockedPeopleReader.readBlockedPeople("u1")).resolves.toEqual([
      { id: "u2", displayName: "Анна", nick: "anna", blockedAt },
    ]);
    expect(db.prisma.block.findMany).toHaveBeenCalledWith({
      where: { blockerId: "u1" },
      select: {
        createdAt: true,
        blocked: { select: { id: true, name: true, nick: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  });
});
