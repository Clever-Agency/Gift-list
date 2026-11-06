import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const db = vi.hoisted(() => ({
  friendship: { findUnique: vi.fn() },
  friendshipInvite: { findUnique: vi.fn() },
  block: { findFirst: vi.fn() },
}));

vi.mock("@/db/client", () => ({ prisma: db }));

import { readProfileRelationship, relationshipReader } from "@/lib/relationships";

const ALPHA = "alpha_user";
const ZEBRA = "zebra_user";

const NO_RELATION_FACTS = {
  blocked: false,
  friend: false,
  subscriber: false,
  contactMatch: false,
};

describe("relationshipReader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.friendship.findUnique.mockResolvedValue(null);
    db.friendshipInvite.findUnique.mockResolvedValue(null);
    db.block.findFirst.mockResolvedValue(null);
  });

  it("reports no relations for an anonymous visitor without reading the database", async () => {
    await expect(relationshipReader.relationsBetween(null, ALPHA)).resolves.toEqual(
      NO_RELATION_FACTS,
    );
    expect(db.friendship.findUnique).not.toHaveBeenCalled();
    expect(db.block.findFirst).not.toHaveBeenCalled();
  });

  it("reports no relations for the owner without reading the database", async () => {
    await expect(relationshipReader.relationsBetween(ALPHA, ALPHA)).resolves.toEqual(
      NO_RELATION_FACTS,
    );
    expect(db.friendship.findUnique).not.toHaveBeenCalled();
    expect(db.block.findFirst).not.toHaveBeenCalled();
  });

  it("reports a friend from an accepted Friendship edge", async () => {
    db.friendship.findUnique.mockResolvedValue({ id: "friendship_1" });

    await expect(relationshipReader.relationsBetween(ZEBRA, ALPHA)).resolves.toEqual({
      ...NO_RELATION_FACTS,
      friend: true,
    });
  });

  it("looks up the canonical ordered pair regardless of who asks", async () => {
    await relationshipReader.relationsBetween(ZEBRA, ALPHA);

    expect(db.friendship.findUnique).toHaveBeenCalledWith({
      where: { userLowId_userHighId: { userLowId: ALPHA, userHighId: ZEBRA } },
      select: { id: true },
    });
  });

  it("reports a block made by the viewer", async () => {
    db.block.findFirst.mockResolvedValue({ id: "block_1" });

    await expect(relationshipReader.relationsBetween(ALPHA, ZEBRA)).resolves.toEqual({
      ...NO_RELATION_FACTS,
      blocked: true,
    });
  });

  it("reports a block made by the owner and queries both directions", async () => {
    db.block.findFirst.mockResolvedValue({ id: "block_1" });

    await expect(relationshipReader.relationsBetween(ZEBRA, ALPHA)).resolves.toEqual({
      ...NO_RELATION_FACTS,
      blocked: true,
    });
    expect(db.block.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { blockerId: ZEBRA, blockedId: ALPHA },
          { blockerId: ALPHA, blockedId: ZEBRA },
        ],
      },
      select: { id: true },
    });
  });

  it("keeps friend and block facts independent", async () => {
    db.friendship.findUnique.mockResolvedValue({ id: "friendship_1" });
    db.block.findFirst.mockResolvedValue({ id: "block_1" });

    await expect(relationshipReader.relationsBetween(ALPHA, ZEBRA)).resolves.toEqual({
      ...NO_RELATION_FACTS,
      friend: true,
      blocked: true,
    });
  });

  it("never invents a subscriber or a contact match", async () => {
    const facts = await relationshipReader.relationsBetween(ALPHA, ZEBRA);

    expect(facts.subscriber).toBe(false);
    expect(facts.contactMatch).toBe(false);
    expect(Object.keys(facts).sort()).toEqual([
      "blocked",
      "contactMatch",
      "friend",
      "subscriber",
    ]);
  });
});

describe("readProfileRelationship (Story 4.1.2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.friendship.findUnique.mockResolvedValue(null);
    db.friendshipInvite.findUnique.mockResolvedValue(null);
    db.block.findFirst.mockResolvedValue(null);
  });

  it("returns NONE for the owner and an anonymous viewer without reading the database", async () => {
    await expect(readProfileRelationship(ALPHA, ALPHA)).resolves.toBe("NONE");
    await expect(readProfileRelationship(null, ALPHA)).resolves.toBe("NONE");

    expect(db.friendship.findUnique).not.toHaveBeenCalled();
    expect(db.friendshipInvite.findUnique).not.toHaveBeenCalled();
    expect(db.block.findFirst).not.toHaveBeenCalled();
  });

  it("returns FRIENDS from the accepted edge and never asks about invites", async () => {
    db.friendship.findUnique.mockResolvedValue({ id: "friendship_1" });

    await expect(readProfileRelationship(ZEBRA, ALPHA)).resolves.toBe("FRIENDS");
    expect(db.friendship.findUnique).toHaveBeenCalledWith({
      where: { userLowId_userHighId: { userLowId: ALPHA, userHighId: ZEBRA } },
      select: { id: true },
    });
  });

  it("returns OUTGOING_PENDING when the viewer has a pending invite", async () => {
    db.friendshipInvite.findUnique.mockImplementation(
      ({ where }: { where: { fromUserId_toUserId: { fromUserId: string; toUserId: string } } }) => {
        const { fromUserId, toUserId } = where.fromUserId_toUserId;
        return Promise.resolve(
          fromUserId === ZEBRA && toUserId === ALPHA ? { id: "invite_1" } : null,
        );
      },
    );

    await expect(readProfileRelationship(ZEBRA, ALPHA)).resolves.toBe("OUTGOING_PENDING");
    expect(db.friendshipInvite.findUnique).toHaveBeenCalledWith({
      where: { fromUserId_toUserId: { fromUserId: ZEBRA, toUserId: ALPHA } },
      select: { id: true },
    });
    expect(db.friendshipInvite.findUnique).toHaveBeenCalledWith({
      where: { fromUserId_toUserId: { fromUserId: ALPHA, toUserId: ZEBRA } },
      select: { id: true },
    });
  });

  it("returns INCOMING_PENDING when the owner has a pending invite", async () => {
    db.friendshipInvite.findUnique.mockImplementation(
      ({ where }: { where: { fromUserId_toUserId: { fromUserId: string; toUserId: string } } }) => {
        const { fromUserId, toUserId } = where.fromUserId_toUserId;
        return Promise.resolve(
          fromUserId === ALPHA && toUserId === ZEBRA ? { id: "invite_1" } : null,
        );
      },
    );

    await expect(readProfileRelationship(ZEBRA, ALPHA)).resolves.toBe("INCOMING_PENDING");
  });

  it("returns NONE when neither edge exists", async () => {
    await expect(readProfileRelationship(ZEBRA, ALPHA)).resolves.toBe("NONE");
  });

  it("lets the accepted friendship win over a stale pending invite", async () => {
    db.friendship.findUnique.mockResolvedValue({ id: "friendship_1" });
    db.friendshipInvite.findUnique.mockResolvedValue({ id: "invite_1" });

    await expect(readProfileRelationship(ZEBRA, ALPHA)).resolves.toBe("FRIENDS");
  });

  it("leaves the Block gate to readWishlist and does not read Block itself", async () => {
    db.block.findFirst.mockResolvedValue({ id: "block_1" });

    await expect(readProfileRelationship(ZEBRA, ALPHA)).resolves.toBe("NONE");
    expect(db.block.findFirst).not.toHaveBeenCalled();
  });
});
