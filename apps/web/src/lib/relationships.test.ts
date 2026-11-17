import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const db = vi.hoisted(() => ({
  friendship: { findUnique: vi.fn(), findMany: vi.fn() },
  friendshipInvite: { findUnique: vi.fn(), findMany: vi.fn() },
  inviteCooldown: { findUnique: vi.fn(), findMany: vi.fn() },
  block: { findFirst: vi.fn() },
  subscription: { findUnique: vi.fn(), findMany: vi.fn() },
}));

vi.mock("@/db/client", () => ({ prisma: db }));

import {
  profileRelationFacts,
  readProfileInviteCooldown,
  readProfileRelations,
  readProfileRelationship,
  readProfileSubscription,
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
    db.subscription.findUnique.mockResolvedValue(null);
  });

  it("reports no relations for an anonymous visitor without reading the database", async () => {
    await expect(relationshipReader.relationsBetween(null, ALPHA)).resolves.toEqual(
      NO_RELATION_FACTS,
    );
    expect(db.friendship.findUnique).not.toHaveBeenCalled();
    expect(db.block.findFirst).not.toHaveBeenCalled();
    expect(db.subscription.findUnique).not.toHaveBeenCalled();
  });

  it("reports no relations for the owner without reading the database", async () => {
    await expect(relationshipReader.relationsBetween(ALPHA, ALPHA)).resolves.toEqual(
      NO_RELATION_FACTS,
    );
    expect(db.friendship.findUnique).not.toHaveBeenCalled();
    expect(db.block.findFirst).not.toHaveBeenCalled();
    expect(db.subscription.findUnique).not.toHaveBeenCalled();
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

  it("reports a subscriber from a directed Subscription row (Story 4.6, AD-19)", async () => {
    db.subscription.findUnique.mockResolvedValue({ id: "subscription_1" });

    await expect(relationshipReader.relationsBetween(ZEBRA, ALPHA)).resolves.toEqual({
      ...NO_RELATION_FACTS,
      subscriber: true,
    });
    expect(db.subscription.findUnique).toHaveBeenCalledWith({
      where: { subscriberId_targetId: { subscriberId: ZEBRA, targetId: ALPHA } },
      select: { id: true },
    });
  });

  it("reads the direction viewer → owner, not the opposite one", async () => {
    db.subscription.findUnique.mockResolvedValue({ id: "subscription_1" });

    const facts = await relationshipReader.relationsBetween(ALPHA, ZEBRA);

    expect(facts.subscriber).toBe(true);
    expect(db.subscription.findUnique).toHaveBeenCalledWith({
      where: { subscriberId_targetId: { subscriberId: ALPHA, targetId: ZEBRA } },
      select: { id: true },
    });
  });

  it("does not turn a subscription into a friendship (D-31)", async () => {
    db.subscription.findUnique.mockResolvedValue({ id: "subscription_1" });

    const facts = await relationshipReader.relationsBetween(ZEBRA, ALPHA);

    expect(facts).toEqual({ ...NO_RELATION_FACTS, subscriber: true });
    expect(facts.friend).toBe(false);
  });

  it("reports no subscriber when the edge points the other way", async () => {
    // The fake answers only the edge it is asked for; ALPHA → ZEBRA is absent.
    db.subscription.findUnique.mockImplementation(
      ({ where }: { where: { subscriberId_targetId: { subscriberId: string } } }) =>
        Promise.resolve(
          where.subscriberId_targetId.subscriberId === ZEBRA
            ? { id: "subscription_1" }
            : null,
        ),
    );

    await expect(relationshipReader.relationsBetween(ZEBRA, ALPHA)).resolves.toEqual({
      ...NO_RELATION_FACTS,
      subscriber: true,
    });
    await expect(relationshipReader.relationsBetween(ALPHA, ZEBRA)).resolves.toEqual(
      NO_RELATION_FACTS,
    );
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

describe("readProfileSubscription (Story 4.6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.subscription.findUnique.mockResolvedValue(null);
  });

  it("returns false for the owner and an anonymous viewer without reading the database", async () => {
    await expect(readProfileSubscription(ALPHA, ALPHA)).resolves.toBe(false);
    await expect(readProfileSubscription(null, ALPHA)).resolves.toBe(false);

    expect(db.subscription.findUnique).not.toHaveBeenCalled();
  });

  it("reads the directed viewer-to-owner edge, not the reverse one", async () => {
    await readProfileSubscription(ZEBRA, ALPHA);

    expect(db.subscription.findUnique).toHaveBeenCalledWith({
      where: { subscriberId_targetId: { subscriberId: ZEBRA, targetId: ALPHA } },
      select: { id: true },
    });
  });

  it("answers false without a row and true when the edge exists", async () => {
    await expect(readProfileSubscription(ZEBRA, ALPHA)).resolves.toBe(false);

    db.subscription.findUnique.mockResolvedValue({ id: "subscription_1" });
    await expect(readProfileSubscription(ZEBRA, ALPHA)).resolves.toBe(true);
  });

  it("never reads a friendship: a subscription is one fact, not a relationship", async () => {
    db.subscription.findUnique.mockResolvedValue({ id: "subscription_1" });

    await readProfileSubscription(ZEBRA, ALPHA);

    expect(db.friendship.findUnique).not.toHaveBeenCalled();
    expect(db.friendshipInvite.findUnique).not.toHaveBeenCalled();
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

describe("readProfileRelations (search cards, CLE-89 / CLE-70 F3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.friendship.findMany.mockResolvedValue([]);
    db.friendshipInvite.findMany.mockResolvedValue([]);
    db.inviteCooldown.findMany.mockResolvedValue([]);
    db.subscription.findMany.mockResolvedValue([]);
  });

  it("keeps the viewer's own row and an anonymous viewer NONE and unsubscribed without a query", async () => {
    await expect(readProfileRelations(ALPHA, [ALPHA])).resolves.toEqual(
      new Map([[ALPHA, { relationship: "NONE", subscribed: false }]]),
    );
    await expect(readProfileRelations(null, [ALPHA, ZEBRA])).resolves.toEqual(
      new Map([
        [ALPHA, { relationship: "NONE", subscribed: false }],
        [ZEBRA, { relationship: "NONE", subscribed: false }],
      ]),
    );

    expect(db.friendship.findMany).not.toHaveBeenCalled();
    expect(db.friendshipInvite.findMany).not.toHaveBeenCalled();
    expect(db.inviteCooldown.findMany).not.toHaveBeenCalled();
    expect(db.subscription.findMany).not.toHaveBeenCalled();
  });

  it("reads a whole page in four flat queries, never two per card", async () => {
    const page = Array.from({ length: 20 }, function ownerId(_, index) {
      return `user_${String(index).padStart(2, "0")}`;
    });

    const facts = await readProfileRelations(ZEBRA, page);

    expect(facts.size).toBe(20);
    expect(db.friendship.findMany).toHaveBeenCalledTimes(1);
    expect(db.friendshipInvite.findMany).toHaveBeenCalledTimes(1);
    expect(db.inviteCooldown.findMany).toHaveBeenCalledTimes(1);
    expect(db.subscription.findMany).toHaveBeenCalledTimes(1);
    const pairQuery = db.friendship.findMany.mock.calls[0]?.[0] as {
      where: { OR: unknown[] };
    };
    expect(pairQuery.where.OR).toHaveLength(20);
  });

  it("queries both pending directions and the viewer's own subscriptions", async () => {
    await readProfileRelations(ZEBRA, [ALPHA]);

    expect(db.friendshipInvite.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { fromUserId: ZEBRA, toUserId: { in: [ALPHA] } },
          { fromUserId: { in: [ALPHA] }, toUserId: ZEBRA },
        ],
      },
      select: { fromUserId: true, toUserId: true },
    });
    expect(db.subscription.findMany).toHaveBeenCalledWith({
      where: { subscriberId: ZEBRA, targetId: { in: [ALPHA] } },
      select: { targetId: true },
    });
  });

  it("fills the four relations and the subscription flag for the page", async () => {
    const page = [ALPHA, "mike_out", "nina_in", "sam_none"];
    db.friendship.findMany.mockResolvedValue([{ userLowId: ALPHA, userHighId: ZEBRA }]);
    db.friendshipInvite.findMany.mockResolvedValue([
      { fromUserId: ZEBRA, toUserId: "mike_out" },
      { fromUserId: "nina_in", toUserId: ZEBRA },
    ]);
    // A subscription is one directed fact and never a friendship (D-31).
    db.subscription.findMany.mockResolvedValue([{ targetId: "mike_out" }]);

    const facts = await readProfileRelations(ZEBRA, page);

    expect(facts.get(ALPHA)).toEqual({ relationship: "FRIENDS", subscribed: false });
    expect(facts.get("mike_out")).toEqual({ relationship: "OUTGOING_PENDING", subscribed: true });
    expect(facts.get("nina_in")).toEqual({ relationship: "INCOMING_PENDING", subscribed: false });
    expect(facts.get("sam_none")).toEqual({ relationship: "NONE", subscribed: false });
  });

  it("maps a canonical pair back to its owner, not to the first row", async () => {
    // The pair is stored low/high, so the viewer may be the high id; the answer
    // still belongs to ALPHA, the person the page asked about.
    db.friendship.findMany.mockResolvedValue([{ userLowId: ALPHA, userHighId: ZEBRA }]);

    const facts = await readProfileRelations(ZEBRA, [ALPHA, "sam_none"]);

    expect(facts.get(ALPHA)).toEqual({ relationship: "FRIENDS", subscribed: false });
    expect(facts.get("sam_none")).toEqual({ relationship: "NONE", subscribed: false });
  });

  it("carries the live cooldown in the profile shape and forces NONE", async () => {
    db.friendshipInvite.findMany.mockResolvedValue([{ fromUserId: ZEBRA, toUserId: ALPHA }]);
    db.inviteCooldown.findMany.mockResolvedValue([
      {
        userLowId: ALPHA,
        userHighId: ZEBRA,
        until: new Date(Date.now() + 5 * 3_600_000),
        rejectedFromUserId: ZEBRA,
      },
    ]);

    const facts = await readProfileRelations(ZEBRA, [ALPHA]);

    expect(facts.get(ALPHA)).toEqual({
      relationship: "NONE",
      inviteCooldown: { hours: 5, rejected: true },
      subscribed: false,
    });
  });

  it("omits the cooldown field when the row has expired", async () => {
    db.inviteCooldown.findMany.mockResolvedValue([
      {
        userLowId: ALPHA,
        userHighId: ZEBRA,
        until: new Date(Date.now() - 1_000),
        rejectedFromUserId: ZEBRA,
      },
    ]);

    const facts = await readProfileRelations(ZEBRA, [ALPHA]);

    expect(facts.get(ALPHA)).toEqual({ relationship: "NONE", subscribed: false });
    expect(facts.get(ALPHA)).not.toHaveProperty("inviteCooldown");
  });

  it("asks once for a repeated id and answers one entry", async () => {
    const facts = await readProfileRelations(ZEBRA, [ALPHA, ALPHA]);

    expect(facts.size).toBe(1);
    const pairQuery = db.friendship.findMany.mock.calls[0]?.[0] as {
      where: { OR: unknown[] };
    };
    expect(pairQuery.where.OR).toHaveLength(1);
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
