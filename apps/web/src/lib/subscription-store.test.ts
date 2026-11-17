import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { createMany, deleteMany, findBlock, createFriendship } = vi.hoisted(() => ({
  createMany: vi.fn(),
  deleteMany: vi.fn(),
  findBlock: vi.fn(),
  createFriendship: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  prisma: {
    subscription: { createMany, deleteMany },
    block: { findFirst: findBlock },
    friendship: { create: createFriendship },
  },
}));

import { subscriptionStore } from "./subscription-store";

beforeEach(() => {
  createMany.mockReset();
  deleteMany.mockReset();
  findBlock.mockReset();
  createFriendship.mockReset();
});

describe("subscriptionStore.createSubscription (Story 4.6, AD-19)", () => {
  it("inserts one directed row and reports that it was created", async () => {
    createMany.mockResolvedValue({ count: 1 });

    await expect(subscriptionStore.createSubscription("u1", "u2")).resolves.toBe(true);

    expect(createMany).toHaveBeenCalledWith({
      data: [{ subscriberId: "u1", targetId: "u2" }],
      skipDuplicates: true,
    });
  });

  it("reports an existing edge as not created: the UNIQUE index decides, not a read-before-write", async () => {
    createMany.mockResolvedValue({ count: 0 });

    await expect(subscriptionStore.createSubscription("u1", "u2")).resolves.toBe(false);

    expect(createMany).toHaveBeenCalledTimes(1);
  });

  it("never writes a friendship (D-31)", async () => {
    createMany.mockResolvedValue({ count: 1 });

    await subscriptionStore.createSubscription("u1", "u2");

    expect(createFriendship).not.toHaveBeenCalled();
  });
});

describe("subscriptionStore.deleteSubscription (Story 4.6, AD-19)", () => {
  it("deletes exactly the directed row", async () => {
    deleteMany.mockResolvedValue({ count: 1 });

    await expect(subscriptionStore.deleteSubscription("u1", "u2")).resolves.toBe(true);

    expect(deleteMany).toHaveBeenCalledWith({
      where: { subscriberId: "u1", targetId: "u2" },
    });
  });

  it("reports an already missing row with the same statement", async () => {
    deleteMany.mockResolvedValue({ count: 0 });

    await expect(subscriptionStore.deleteSubscription("u1", "u2")).resolves.toBe(false);

    expect(deleteMany).toHaveBeenCalledTimes(1);
  });
});

describe("subscriptionStore.hasBlockBetween (AD-10 step 4)", () => {
  it("looks for a Block in both directions", async () => {
    findBlock.mockResolvedValue({ id: "block_1" });

    await expect(subscriptionStore.hasBlockBetween("u1", "u2")).resolves.toBe(true);

    expect(findBlock).toHaveBeenCalledWith({
      where: {
        OR: [
          { blockerId: "u1", blockedId: "u2" },
          { blockerId: "u2", blockedId: "u1" },
        ],
      },
      select: { id: true },
    });
  });

  it("answers false when nobody blocked the other", async () => {
    findBlock.mockResolvedValue(null);

    await expect(subscriptionStore.hasBlockBetween("u1", "u2")).resolves.toBe(false);
  });
});
