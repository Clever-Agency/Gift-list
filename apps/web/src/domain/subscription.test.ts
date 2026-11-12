import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  removeSubscription,
  subscribeToUser,
  type SubscriptionStore,
} from "./subscription";
import { NO_RELATIONS, VisibilityPolicy } from "./visibility";

type Edge = { subscriberId: string; targetId: string };

/** In-memory stand-in for the Prisma adapter, so the rules run unmodified. */
function createStore() {
  const edges: Edge[] = [];
  const store: SubscriptionStore = {
    createSubscription: vi.fn(async (subscriberId: string, targetId: string) => {
      if (edges.some((edge) => edge.subscriberId === subscriberId && edge.targetId === targetId)) {
        return false;
      }
      edges.push({ subscriberId, targetId });
      return true;
    }),
    deleteSubscription: vi.fn(async (subscriberId: string, targetId: string) => {
      const index = edges.findIndex(
        (edge) => edge.subscriberId === subscriberId && edge.targetId === targetId,
      );
      if (index === -1) return false;
      edges.splice(index, 1);
      return true;
    }),
    hasBlockBetween: vi.fn(async () => false),
  };
  return { store, edges };
}

let fixture: ReturnType<typeof createStore>;

beforeEach(() => {
  fixture = createStore();
});

describe("subscribeToUser (Story 4.6, AD-19)", () => {
  it("inserts one directed row without confirmation and reports SUBSCRIBED", async () => {
    const result = await subscribeToUser(
      { subscriberId: "u1", targetId: "u2" },
      fixture.store,
    );

    expect(result).toEqual({ ok: true, outcome: "SUBSCRIBED" });
    expect(fixture.edges).toEqual([{ subscriberId: "u1", targetId: "u2" }]);
    expect(fixture.store.hasBlockBetween).toHaveBeenCalledWith("u1", "u2");
  });

  it("treats a repeat as a successful no-op with one row still stored", async () => {
    await subscribeToUser({ subscriberId: "u1", targetId: "u2" }, fixture.store);
    const repeat = await subscribeToUser(
      { subscriberId: "u1", targetId: "u2" },
      fixture.store,
    );

    expect(repeat).toEqual({ ok: true, outcome: "ALREADY_SUBSCRIBED" });
    expect(fixture.edges).toHaveLength(1);
  });

  it("keeps the reverse direction as an independent row", async () => {
    await subscribeToUser({ subscriberId: "u1", targetId: "u2" }, fixture.store);
    await subscribeToUser({ subscriberId: "u2", targetId: "u1" }, fixture.store);

    expect(fixture.edges).toEqual([
      { subscriberId: "u1", targetId: "u2" },
      { subscriberId: "u2", targetId: "u1" },
    ]);
  });

  it("refuses a self subscription before the database is touched", async () => {
    const result = await subscribeToUser(
      { subscriberId: "u1", targetId: "u1" },
      fixture.store,
    );

    expect(result).toEqual({ ok: false, code: "FORBIDDEN", reason: "SELF_SUBSCRIPTION" });
    expect(fixture.store.hasBlockBetween).not.toHaveBeenCalled();
    expect(fixture.store.createSubscription).not.toHaveBeenCalled();
    expect(fixture.edges).toHaveLength(0);
  });

  it("refuses a subscription across a Block in either direction", async () => {
    vi.mocked(fixture.store.hasBlockBetween).mockResolvedValue(true);

    const result = await subscribeToUser(
      { subscriberId: "u1", targetId: "u2" },
      fixture.store,
    );

    expect(result).toEqual({ ok: false, code: "FORBIDDEN", reason: "BLOCKED" });
    expect(fixture.store.createSubscription).not.toHaveBeenCalled();
    expect(fixture.edges).toHaveLength(0);
  });

  it("never asks the store for a friendship", async () => {
    await subscribeToUser({ subscriberId: "u1", targetId: "u2" }, fixture.store);

    expect(Object.keys(fixture.store).sort()).toEqual([
      "createSubscription",
      "deleteSubscription",
      "hasBlockBetween",
    ]);
  });

  it("is not a friendship: the subscriber fact opens PUBLIC and never FRIENDS (D-31)", async () => {
    await subscribeToUser({ subscriberId: "u1", targetId: "u2" }, fixture.store);

    const relations = { ...NO_RELATIONS, subscriber: true };
    const viewer = { id: "u1" };
    const owner = "u2";

    expect(
      VisibilityPolicy.canSee(viewer, relations, {
        ownerId: owner,
        visibility: "PUBLIC",
        archivedAt: null,
      }),
    ).toBe(true);
    expect(
      VisibilityPolicy.canSee(viewer, relations, {
        ownerId: owner,
        visibility: "FRIENDS",
        archivedAt: null,
      }),
    ).toBe(false);
    expect(
      VisibilityPolicy.canSee(viewer, relations, {
        ownerId: owner,
        visibility: "SECRET",
        archivedAt: null,
      }),
    ).toBe(false);
    expect(VisibilityPolicy.allowedVisibilities(viewer, relations, owner)).toEqual(["PUBLIC"]);
  });
});

describe("removeSubscription (Story 4.6, AD-19)", () => {
  it("deletes exactly the directed row and reports UNSUBSCRIBED", async () => {
    await subscribeToUser({ subscriberId: "u1", targetId: "u2" }, fixture.store);

    const result = await removeSubscription(
      { subscriberId: "u1", targetId: "u2" },
      fixture.store,
    );

    expect(result).toEqual({ ok: true, outcome: "UNSUBSCRIBED" });
    expect(fixture.edges).toHaveLength(0);
  });

  it("treats a repeat removal as a successful no-op", async () => {
    await subscribeToUser({ subscriberId: "u1", targetId: "u2" }, fixture.store);
    await removeSubscription({ subscriberId: "u1", targetId: "u2" }, fixture.store);
    const repeat = await removeSubscription(
      { subscriberId: "u1", targetId: "u2" },
      fixture.store,
    );

    expect(repeat).toEqual({ ok: true, outcome: "NOT_SUBSCRIBED" });
  });

  it("allows the target to remove the subscriber through the same primitive", async () => {
    await subscribeToUser({ subscriberId: "u1", targetId: "u2" }, fixture.store);

    const result = await removeSubscription(
      { subscriberId: "u1", targetId: "u2" },
      fixture.store,
    );

    expect(result).toEqual({ ok: true, outcome: "UNSUBSCRIBED" });
  });

  it("does not read a Block, so a block cannot keep a stale row alive", async () => {
    await subscribeToUser({ subscriberId: "u1", targetId: "u2" }, fixture.store);
    vi.mocked(fixture.store.hasBlockBetween).mockClear();

    await removeSubscription({ subscriberId: "u1", targetId: "u2" }, fixture.store);

    expect(fixture.store.hasBlockBetween).not.toHaveBeenCalled();
    expect(fixture.edges).toHaveLength(0);
  });

  it("refuses a self removal before the database is touched", async () => {
    const result = await removeSubscription(
      { subscriberId: "u1", targetId: "u1" },
      fixture.store,
    );

    expect(result).toEqual({ ok: false, code: "FORBIDDEN", reason: "SELF_SUBSCRIPTION" });
    expect(fixture.store.deleteSubscription).not.toHaveBeenCalled();
  });
});
