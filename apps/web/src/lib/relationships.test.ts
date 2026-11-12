import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const db = vi.hoisted(() => ({
  friendship: { findUnique: vi.fn() },
  friendshipInvite: { findUnique: vi.fn() },
  inviteCooldown: { findUnique: vi.fn() },
  block: { findFirst: vi.fn() },
}));

vi.mock("@/db/client", () => ({ prisma: db }));

import {
  profileRelationFacts,
  readProfileInviteCooldown,
  readProfileRelation,
  readProfileRelationship,
  relationshipReader,
} from "@/lib/relationships";

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
    db.inviteCooldown.findUnique.mockResolvedValue(null);
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
    db.inviteCooldown.findUnique.mockResolvedValue(null);
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

describe("readProfileInviteCooldown (Story 4.2.2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.inviteCooldown.findUnique.mockResolvedValue(null);
  });

  it("returns null for the owner and an anonymous viewer without reading the database", async () => {
    await expect(readProfileInviteCooldown(ALPHA, ALPHA)).resolves.toBeNull();
    await expect(readProfileInviteCooldown(null, ALPHA)).resolves.toBeNull();

    expect(db.inviteCooldown.findUnique).not.toHaveBeenCalled();
  });

  it("returns null when the pair has no cooldown row", async () => {
    await expect(readProfileInviteCooldown(ZEBRA, ALPHA)).resolves.toBeNull();
  });

  it("queries the canonical ordered pair", async () => {
    await readProfileInviteCooldown(ZEBRA, ALPHA);

    expect(db.inviteCooldown.findUnique).toHaveBeenCalledWith({
      where: { userLowId_userHighId: { userLowId: ALPHA, userHighId: ZEBRA } },
      select: { until: true, rejectedFromUserId: true },
    });
  });

  it("flags the rejected sender A with the remaining whole hours", async () => {
    db.inviteCooldown.findUnique.mockResolvedValue({
      until: new Date(Date.now() + 5 * 3_600_000),
      rejectedFromUserId: ZEBRA,
    });

    const cooldown = await readProfileInviteCooldown(ZEBRA, ALPHA);

    expect(cooldown?.rejected).toBe(true);
    expect(cooldown?.hours).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(cooldown?.hours)).toBe(true);
  });

  it("does not flag the rejecting recipient B, but still gives the hours", async () => {
    db.inviteCooldown.findUnique.mockResolvedValue({
      until: new Date(Date.now() + 5 * 3_600_000),
      rejectedFromUserId: ZEBRA,
    });

    const cooldown = await readProfileInviteCooldown(ALPHA, ZEBRA);

    expect(cooldown?.rejected).toBe(false);
    expect(cooldown?.hours).toBeGreaterThanOrEqual(1);
  });

  it("rounds up and never reports less than one hour while the window is open", async () => {
    db.inviteCooldown.findUnique.mockResolvedValue({
      until: new Date(Date.now() + 1_000),
      rejectedFromUserId: ZEBRA,
    });

    await expect(readProfileInviteCooldown(ZEBRA, ALPHA)).resolves.toEqual({
      hours: 1,
      rejected: true,
    });
  });

  it("returns null for an expired row and does not delete it on read", async () => {
    db.inviteCooldown.findUnique.mockResolvedValue({
      until: new Date(Date.now() - 1_000),
      rejectedFromUserId: ZEBRA,
    });

    await expect(readProfileInviteCooldown(ZEBRA, ALPHA)).resolves.toBeNull();
  });
});

describe("readProfileRelation (search cards, CLE-89)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.friendship.findUnique.mockResolvedValue(null);
    db.friendshipInvite.findUnique.mockResolvedValue(null);
    db.inviteCooldown.findUnique.mockResolvedValue(null);
    db.block.findFirst.mockResolvedValue(null);
  });

  it("answers the closed relation alone when no cooldown is live", async () => {
    db.friendship.findUnique.mockResolvedValue({ id: "friendship_1" });

    await expect(readProfileRelation(ZEBRA, ALPHA)).resolves.toEqual({ relationship: "FRIENDS" });
  });

  it("keeps NONE for the viewer's own card without reading the database", async () => {
    await expect(readProfileRelation(ALPHA, ALPHA)).resolves.toEqual({ relationship: "NONE" });
    await expect(readProfileRelation(null, ALPHA)).resolves.toEqual({ relationship: "NONE" });

    expect(db.friendship.findUnique).not.toHaveBeenCalled();
    expect(db.friendshipInvite.findUnique).not.toHaveBeenCalled();
    expect(db.inviteCooldown.findUnique).not.toHaveBeenCalled();
  });

  it("forces NONE and carries the profile-shaped cooldown while the window is live", async () => {
    db.friendshipInvite.findUnique.mockResolvedValue({ id: "invite_1" });
    db.inviteCooldown.findUnique.mockResolvedValue({
      until: new Date(Date.now() + 5 * 3_600_000),
      rejectedFromUserId: ZEBRA,
    });

    await expect(readProfileRelation(ZEBRA, ALPHA)).resolves.toEqual({
      relationship: "NONE",
      inviteCooldown: { hours: 5, rejected: true },
    });
  });

  it("omits the cooldown field when the row is expired", async () => {
    db.inviteCooldown.findUnique.mockResolvedValue({
      until: new Date(Date.now() - 1_000),
      rejectedFromUserId: ZEBRA,
    });

    await expect(readProfileRelation(ZEBRA, ALPHA)).resolves.toEqual({ relationship: "NONE" });
  });
});

describe("profileRelationFacts", () => {
  it("returns the relation alone and no cooldown key without a live cooldown", () => {
    const facts = profileRelationFacts("INCOMING_PENDING", null);

    expect(facts).toEqual({ relationship: "INCOMING_PENDING" });
    expect(facts).not.toHaveProperty("inviteCooldown");
  });

  it("forces NONE next to a live cooldown", () => {
    expect(profileRelationFacts("FRIENDS", { hours: 3, rejected: false })).toEqual({
      relationship: "NONE",
      inviteCooldown: { hours: 3, rejected: false },
    });
  });
});
