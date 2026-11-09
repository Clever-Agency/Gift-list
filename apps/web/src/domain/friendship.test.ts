import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  acceptFriendInvite,
  orderFriendPair,
  rejectFriendInvite,
  sendFriendInvite,
  type FriendshipPair,
  type FriendshipStore,
  type FriendshipTransaction,
} from "@/domain/friendship";

type Invite = { readonly fromUserId: string; readonly toUserId: string };
type Block = { readonly blockerId: string; readonly blockedId: string };
type Cooldown = FriendshipPair & {
  rejectedFromUserId: string;
  until: Date;
};

type Memory = {
  invites: Invite[];
  friendships: FriendshipPair[];
  blocks: Block[];
  cooldowns: Cooldown[];
  transactions: number;
  writes: string[];
  locks: FriendshipPair[];
  trace: string[];
};

/** In-memory protocol store: no database, but the same closed port the adapter implements. */
function createStore(seed: Partial<Memory> = {}) {
  const memory: Memory = {
    invites: [],
    friendships: [],
    blocks: [],
    cooldowns: [],
    transactions: 0,
    writes: [],
    locks: [],
    trace: [],
    ...seed,
  };

  const store: FriendshipStore = {
    async transaction(work) {
      memory.transactions += 1;
      const tx: FriendshipTransaction = {
        async lockPair(pair) {
          memory.locks.push(pair);
          memory.trace.push("lock");
        },
        async hasBlockBetween(firstUserId, secondUserId) {
          memory.trace.push("block");
          return memory.blocks.some(
            (block) =>
              (block.blockerId === firstUserId && block.blockedId === secondUserId) ||
              (block.blockerId === secondUserId && block.blockedId === firstUserId),
          );
        },
        async findFriendship(pair) {
          memory.trace.push("friendship");
          return memory.friendships.some(
            (edge) => edge.userLowId === pair.userLowId && edge.userHighId === pair.userHighId,
          );
        },
        async findPendingInvite(fromUserId, toUserId) {
          memory.trace.push("pending");
          return memory.invites.some(
            (invite) => invite.fromUserId === fromUserId && invite.toUserId === toUserId,
          );
        },
        async createInvite(fromUserId, toUserId) {
          memory.invites.push({ fromUserId, toUserId });
          memory.writes.push("invite");
        },
        async deleteInvite(fromUserId, toUserId) {
          memory.invites = memory.invites.filter(
            (invite) => !(invite.fromUserId === fromUserId && invite.toUserId === toUserId),
          );
          memory.writes.push("delete-invite");
        },
        async createFriendship(pair) {
          memory.friendships.push(pair);
          memory.writes.push("friendship");
        },
        async deleteInvitesBetween(firstUserId, secondUserId) {
          memory.invites = memory.invites.filter(
            (invite) =>
              !(
                (invite.fromUserId === firstUserId && invite.toUserId === secondUserId) ||
                (invite.fromUserId === secondUserId && invite.toUserId === firstUserId)
              ),
          );
          memory.writes.push("delete-invites");
        },
        async findInviteCooldown(pair) {
          memory.trace.push("cooldown-read");
          return (
            memory.cooldowns.find(
              (row) => row.userLowId === pair.userLowId && row.userHighId === pair.userHighId,
            ) ?? null
          );
        },
        async createInviteCooldown(pair, rejectedFromUserId, until) {
          memory.cooldowns = memory.cooldowns.filter(
            (row) => !(row.userLowId === pair.userLowId && row.userHighId === pair.userHighId),
          );
          memory.cooldowns.push({ ...pair, rejectedFromUserId, until });
          memory.writes.push("cooldown");
        },
        async deleteInviteCooldown(pair) {
          memory.cooldowns = memory.cooldowns.filter(
            (row) => !(row.userLowId === pair.userLowId && row.userHighId === pair.userHighId),
          );
          memory.writes.push("delete-cooldown");
        },
      };
      return work(tx);
    },
  };

  return { memory, store };
}

/**
 * Wraps the memory store in a promise chain so two protocol calls run one after
 * another, the way the PostgreSQL pair lock orders them. The chain is only a
 * simulation: the real serialization proof is the disposable-PostgreSQL test.
 */
function createSerializedStore(seed: Partial<Memory> = {}) {
  const base = createStore(seed);
  let tail: Promise<unknown> = Promise.resolve();

  const store: FriendshipStore = {
    transaction(work) {
      const run = tail.then(() => base.store.transaction(work));
      tail = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
  };

  return { memory: base.memory, store };
}

const ALPHA = "alpha_user";
const ZEBRA = "zebra_user";
const NOW = new Date("2026-11-07T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function pairOf(): FriendshipPair {
  return { userLowId: ALPHA, userHighId: ZEBRA };
}

function useNow(now: Date): void {
  vi.useFakeTimers();
  vi.setSystemTime(now);
}

describe("orderFriendPair", () => {
  it("returns the same ascending pair regardless of argument order", () => {
    expect(orderFriendPair(ZEBRA, ALPHA)).toEqual({ userLowId: ALPHA, userHighId: ZEBRA });
    expect(orderFriendPair(ALPHA, ZEBRA)).toEqual({ userLowId: ALPHA, userHighId: ZEBRA });
  });
});

describe("sendFriendInvite", () => {
  let memory: Memory;
  let store: FriendshipStore;

  beforeEach(() => {
    ({ memory, store } = createStore());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("refuses to invite yourself before touching the store", async () => {
    const result = await sendFriendInvite({ fromUserId: ALPHA, toUserId: ALPHA }, store);

    expect(result).toEqual({ ok: false, code: "FORBIDDEN", reason: "SELF_INVITE" });
    expect(memory.transactions).toBe(0);
    expect(memory.locks).toEqual([]);
    expect(memory.invites).toEqual([]);
    expect(memory.writes).toEqual([]);
  });

  it("refuses when the sender blocked the target", async () => {
    ({ memory, store } = createStore({
      blocks: [{ blockerId: ALPHA, blockedId: ZEBRA }],
    }));

    const result = await sendFriendInvite({ fromUserId: ALPHA, toUserId: ZEBRA }, store);

    expect(result).toEqual({ ok: false, code: "FORBIDDEN", reason: "BLOCKED" });
    expect(memory.invites).toEqual([]);
    expect(memory.friendships).toEqual([]);
    expect(memory.writes).toEqual([]);
  });

  it("refuses when the target blocked the sender", async () => {
    ({ memory, store } = createStore({
      blocks: [{ blockerId: ZEBRA, blockedId: ALPHA }],
    }));

    const result = await sendFriendInvite({ fromUserId: ALPHA, toUserId: ZEBRA }, store);

    expect(result).toEqual({ ok: false, code: "FORBIDDEN", reason: "BLOCKED" });
    expect(memory.invites).toEqual([]);
    expect(memory.writes).toEqual([]);
  });

  it("creates exactly one directed pending invite", async () => {
    const result = await sendFriendInvite({ fromUserId: ALPHA, toUserId: ZEBRA }, store);

    expect(result).toEqual({ ok: true, outcome: "INVITED" });
    expect(memory.invites).toEqual([{ fromUserId: ALPHA, toUserId: ZEBRA }]);
    expect(memory.friendships).toEqual([]);
    expect(memory.transactions).toBe(1);
    expect(memory.locks).toEqual([{ userLowId: ALPHA, userHighId: ZEBRA }]);
    expect(memory.trace[0]).toBe("lock");
  });

  it("keeps the existing pending invite instead of adding a second row", async () => {
    ({ memory, store } = createStore({
      invites: [{ fromUserId: ALPHA, toUserId: ZEBRA }],
    }));

    const result = await sendFriendInvite({ fromUserId: ALPHA, toUserId: ZEBRA }, store);

    expect(result).toEqual({ ok: true, outcome: "PENDING" });
    expect(memory.invites).toEqual([{ fromUserId: ALPHA, toUserId: ZEBRA }]);
    expect(memory.writes).toEqual([]);
    expect(memory.transactions).toBe(1);
  });

  it("does nothing when the friendship already exists", async () => {
    ({ memory, store } = createStore({
      friendships: [{ userLowId: ALPHA, userHighId: ZEBRA }],
    }));

    const result = await sendFriendInvite({ fromUserId: ALPHA, toUserId: ZEBRA }, store);

    expect(result).toEqual({ ok: true, outcome: "ALREADY_FRIENDS" });
    expect(memory.friendships).toHaveLength(1);
    expect(memory.invites).toEqual([]);
    expect(memory.writes).toEqual([]);
  });

  it("accepts a reverse pending invite in one transaction and clears both invites", async () => {
    ({ memory, store } = createStore({
      invites: [{ fromUserId: ZEBRA, toUserId: ALPHA }],
    }));

    const result = await sendFriendInvite({ fromUserId: ALPHA, toUserId: ZEBRA }, store);

    expect(result).toEqual({ ok: true, outcome: "FRIENDS_CREATED" });
    expect(memory.transactions).toBe(1);
    expect(memory.friendships).toEqual([{ userLowId: ALPHA, userHighId: ZEBRA }]);
    expect(memory.invites).toEqual([]);
    expect(memory.writes).toEqual(["friendship", "delete-invites", "delete-cooldown"]);
  });

  it("refuses the reverse-pending auto-accept while a live cooldown exists", async () => {
    useNow(NOW);
    ({ memory, store } = createStore({
      invites: [{ fromUserId: ZEBRA, toUserId: ALPHA }],
      cooldowns: [{ ...pairOf(), rejectedFromUserId: ZEBRA, until: new Date(NOW.getTime() + DAY_MS) }],
    }));

    const result = await sendFriendInvite({ fromUserId: ALPHA, toUserId: ZEBRA }, store);

    expect(result).toEqual({
      ok: false,
      code: "RATE_LIMITED",
      reason: "INVITE_COOLDOWN",
      hours: 24,
    });
    expect(memory.friendships).toEqual([]);
    expect(memory.invites).toEqual([{ fromUserId: ZEBRA, toUserId: ALPHA }]);
    expect(memory.writes).toEqual([]);
    expect(memory.cooldowns).toHaveLength(1);
  });

  it("clears an expired cooldown before auto-accepting a reverse pending", async () => {
    useNow(NOW);
    ({ memory, store } = createStore({
      invites: [{ fromUserId: ZEBRA, toUserId: ALPHA }],
      cooldowns: [{ ...pairOf(), rejectedFromUserId: ZEBRA, until: new Date(NOW.getTime() - 1) }],
    }));

    const result = await sendFriendInvite({ fromUserId: ALPHA, toUserId: ZEBRA }, store);

    expect(result).toEqual({ ok: true, outcome: "FRIENDS_CREATED" });
    expect(memory.cooldowns).toEqual([]);
    expect(memory.writes).toEqual([
      "delete-cooldown",
      "friendship",
      "delete-invites",
      "delete-cooldown",
    ]);
  });

  it("orders the edge as userLowId < userHighId whatever the send direction", async () => {
    ({ memory, store } = createStore({
      invites: [{ fromUserId: ALPHA, toUserId: ZEBRA }],
    }));

    const result = await sendFriendInvite({ fromUserId: ZEBRA, toUserId: ALPHA }, store);

    expect(result).toEqual({ ok: true, outcome: "FRIENDS_CREATED" });
    expect(memory.friendships).toEqual([{ userLowId: ALPHA, userHighId: ZEBRA }]);
  });

  it("refuses a blocked pair even when a friendship edge exists", async () => {
    ({ memory, store } = createStore({
      friendships: [{ userLowId: ALPHA, userHighId: ZEBRA }],
      blocks: [{ blockerId: ZEBRA, blockedId: ALPHA }],
    }));

    const result = await sendFriendInvite({ fromUserId: ALPHA, toUserId: ZEBRA }, store);

    expect(result).toEqual({ ok: false, code: "FORBIDDEN", reason: "BLOCKED" });
    expect(memory.writes).toEqual([]);
  });

  it("lets Block win over a live cooldown and leaves the cooldown row untouched", async () => {
    useNow(NOW);
    ({ memory, store } = createStore({
      blocks: [{ blockerId: ALPHA, blockedId: ZEBRA }],
      cooldowns: [{ ...pairOf(), rejectedFromUserId: ALPHA, until: new Date(NOW.getTime() + DAY_MS) }],
    }));

    const result = await sendFriendInvite({ fromUserId: ALPHA, toUserId: ZEBRA }, store);

    expect(result).toEqual({ ok: false, code: "FORBIDDEN", reason: "BLOCKED" });
    expect(memory.writes).toEqual([]);
    expect(memory.cooldowns).toHaveLength(1);
  });

  it("refuses a new invite while the rejection cooldown is live, with whole hours left", async () => {
    useNow(NOW);
    ({ memory, store } = createStore({
      cooldowns: [{ ...pairOf(), rejectedFromUserId: ALPHA, until: new Date(NOW.getTime() + 90 * 60 * 1000) }],
    }));

    const result = await sendFriendInvite({ fromUserId: ALPHA, toUserId: ZEBRA }, store);

    expect(result).toEqual({
      ok: false,
      code: "RATE_LIMITED",
      reason: "INVITE_COOLDOWN",
      hours: 2,
    });
    expect(memory.invites).toEqual([]);
    expect(memory.writes).toEqual([]);
    expect(memory.cooldowns).toHaveLength(1);
  });

  it("never reports zero hours while the cooldown is still open", async () => {
    useNow(new Date(NOW.getTime() + 23 * 60 * 60 * 1000 + 30 * 60 * 1000));
    ({ memory, store } = createStore({
      cooldowns: [{ ...pairOf(), rejectedFromUserId: ALPHA, until: new Date(NOW.getTime() + DAY_MS) }],
    }));

    const result = await sendFriendInvite({ fromUserId: ZEBRA, toUserId: ALPHA }, store);

    expect(result).toEqual({
      ok: false,
      code: "RATE_LIMITED",
      reason: "INVITE_COOLDOWN",
      hours: 1,
    });
    expect(memory.invites).toEqual([]);
  });

  it("lets the pair invite again after until and deletes the expired row in the same transaction", async () => {
    useNow(new Date(NOW.getTime() + DAY_MS));
    ({ memory, store } = createStore({
      cooldowns: [{ ...pairOf(), rejectedFromUserId: ALPHA, until: new Date(NOW.getTime() + DAY_MS) }],
    }));

    const result = await sendFriendInvite({ fromUserId: ALPHA, toUserId: ZEBRA }, store);

    expect(result).toEqual({ ok: true, outcome: "INVITED" });
    expect(memory.cooldowns).toEqual([]);
    expect(memory.invites).toEqual([{ fromUserId: ALPHA, toUserId: ZEBRA }]);
    expect(memory.writes).toEqual(["delete-cooldown", "invite"]);
    expect(memory.locks).toEqual([{ userLowId: ALPHA, userHighId: ZEBRA }]);
  });

  it("serializes simultaneous opposite sends into one edge, never two pendings", async () => {
    const serialized = createSerializedStore();

    const results = await Promise.all([
      sendFriendInvite({ fromUserId: ALPHA, toUserId: ZEBRA }, serialized.store),
      sendFriendInvite({ fromUserId: ZEBRA, toUserId: ALPHA }, serialized.store),
    ]);

    expect(results).toEqual([
      { ok: true, outcome: "INVITED" },
      { ok: true, outcome: "FRIENDS_CREATED" },
    ]);
    expect(serialized.memory.transactions).toBe(2);
    expect(serialized.memory.friendships).toEqual([{ userLowId: ALPHA, userHighId: ZEBRA }]);
    expect(serialized.memory.invites).toEqual([]);
    // Both directions asked for the same canonical lock, so the second waited.
    expect(serialized.memory.locks).toEqual([
      { userLowId: ALPHA, userHighId: ZEBRA },
      { userLowId: ALPHA, userHighId: ZEBRA },
    ]);
  });

  it("serializes simultaneous identical sends into one pending row", async () => {
    const serialized = createSerializedStore();

    const results = await Promise.all([
      sendFriendInvite({ fromUserId: ALPHA, toUserId: ZEBRA }, serialized.store),
      sendFriendInvite({ fromUserId: ALPHA, toUserId: ZEBRA }, serialized.store),
    ]);

    expect(results).toEqual([
      { ok: true, outcome: "INVITED" },
      { ok: true, outcome: "PENDING" },
    ]);
    expect(serialized.memory.invites).toEqual([{ fromUserId: ALPHA, toUserId: ZEBRA }]);
    expect(serialized.memory.friendships).toEqual([]);
  });
});

describe("acceptFriendInvite", () => {
  let memory: Memory;
  let store: FriendshipStore;

  beforeEach(() => {
    ({ memory, store } = createStore());
  });

  it("accepts an incoming pending through the shared primitive and clears the cooldown", async () => {
    ({ memory, store } = createStore({
      invites: [{ fromUserId: ALPHA, toUserId: ZEBRA }],
      cooldowns: [{ ...pairOf(), rejectedFromUserId: ALPHA, until: new Date(NOW.getTime() + DAY_MS) }],
    }));

    const result = await acceptFriendInvite({ fromUserId: ALPHA, viewerId: ZEBRA }, store);

    expect(result).toEqual({ ok: true, outcome: "FRIENDS_CREATED" });
    expect(memory.transactions).toBe(1);
    expect(memory.locks).toEqual([{ userLowId: ALPHA, userHighId: ZEBRA }]);
    expect(memory.trace[0]).toBe("lock");
    expect(memory.friendships).toEqual([{ userLowId: ALPHA, userHighId: ZEBRA }]);
    expect(memory.invites).toEqual([]);
    expect(memory.cooldowns).toEqual([]);
    expect(memory.writes).toEqual(["friendship", "delete-invites", "delete-cooldown"]);
  });

  it("orders the accepted edge as userLowId < userHighId whatever the invite direction", async () => {
    ({ memory, store } = createStore({
      invites: [{ fromUserId: ZEBRA, toUserId: ALPHA }],
    }));

    const result = await acceptFriendInvite({ fromUserId: ZEBRA, viewerId: ALPHA }, store);

    expect(result).toEqual({ ok: true, outcome: "FRIENDS_CREATED" });
    expect(memory.friendships).toEqual([{ userLowId: ALPHA, userHighId: ZEBRA }]);
    expect(memory.invites).toEqual([]);
  });

  it("is recipient-only: the sender cannot accept their own invite", async () => {
    ({ memory, store } = createStore({
      invites: [{ fromUserId: ALPHA, toUserId: ZEBRA }],
    }));

    const result = await acceptFriendInvite({ fromUserId: ZEBRA, viewerId: ALPHA }, store);

    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(memory.friendships).toEqual([]);
    expect(memory.invites).toEqual([{ fromUserId: ALPHA, toUserId: ZEBRA }]);
    expect(memory.writes).toEqual([]);
  });

  it("returns the closed NOT_FOUND when no pending row exists", async () => {
    const result = await acceptFriendInvite({ fromUserId: ALPHA, viewerId: ZEBRA }, store);

    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(memory.writes).toEqual([]);
  });

  it("refuses acceptance when the pair is blocked and writes nothing", async () => {
    ({ memory, store } = createStore({
      invites: [{ fromUserId: ALPHA, toUserId: ZEBRA }],
      blocks: [{ blockerId: ZEBRA, blockedId: ALPHA }],
    }));

    const result = await acceptFriendInvite({ fromUserId: ALPHA, viewerId: ZEBRA }, store);

    expect(result).toEqual({ ok: false, code: "FORBIDDEN" });
    expect(memory.friendships).toEqual([]);
    expect(memory.invites).toEqual([{ fromUserId: ALPHA, toUserId: ZEBRA }]);
    expect(memory.writes).toEqual([]);
  });

  it("returns ALREADY_FRIENDS without a second edge and clears stale pair rows", async () => {
    ({ memory, store } = createStore({
      friendships: [{ userLowId: ALPHA, userHighId: ZEBRA }],
      invites: [{ fromUserId: ALPHA, toUserId: ZEBRA }],
      cooldowns: [{ ...pairOf(), rejectedFromUserId: ALPHA, until: new Date(NOW.getTime() + DAY_MS) }],
    }));

    const result = await acceptFriendInvite({ fromUserId: ALPHA, viewerId: ZEBRA }, store);

    expect(result).toEqual({ ok: true, outcome: "ALREADY_FRIENDS" });
    expect(memory.friendships).toEqual([{ userLowId: ALPHA, userHighId: ZEBRA }]);
    expect(memory.invites).toEqual([]);
    expect(memory.cooldowns).toEqual([]);
    expect(memory.writes).toEqual(["delete-invites", "delete-cooldown"]);
  });

  it("answers NOT_FOUND for a self pair without touching the store", async () => {
    const result = await acceptFriendInvite({ fromUserId: ALPHA, viewerId: ALPHA }, store);

    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(memory.transactions).toBe(0);
    expect(memory.writes).toEqual([]);
  });
});

describe("rejectFriendInvite", () => {
  let memory: Memory;
  let store: FriendshipStore;

  beforeEach(() => {
    useNow(NOW);
    ({ memory, store } = createStore());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("deletes exactly the pending invite and writes one 24-hour cooldown with the sender", async () => {
    ({ memory, store } = createStore({
      invites: [{ fromUserId: ALPHA, toUserId: ZEBRA }],
    }));

    const result = await rejectFriendInvite({ fromUserId: ALPHA, viewerId: ZEBRA }, store);

    expect(result).toEqual({ ok: true, outcome: "REJECTED" });
    expect(memory.transactions).toBe(1);
    expect(memory.locks).toEqual([{ userLowId: ALPHA, userHighId: ZEBRA }]);
    expect(memory.trace[0]).toBe("lock");
    expect(memory.invites).toEqual([]);
    expect(memory.friendships).toEqual([]);
    expect(memory.cooldowns).toEqual([
      {
        userLowId: ALPHA,
        userHighId: ZEBRA,
        rejectedFromUserId: ALPHA,
        until: new Date(NOW.getTime() + DAY_MS),
      },
    ]);
    expect(memory.writes).toEqual(["delete-invite", "cooldown"]);
  });

  it("stores the canonical pair and the actual sender whatever the direction", async () => {
    ({ memory, store } = createStore({
      invites: [{ fromUserId: ZEBRA, toUserId: ALPHA }],
    }));

    const result = await rejectFriendInvite({ fromUserId: ZEBRA, viewerId: ALPHA }, store);

    expect(result).toEqual({ ok: true, outcome: "REJECTED" });
    expect(memory.friendships).toEqual([]);
    expect(memory.cooldowns).toEqual([
      {
        userLowId: ALPHA,
        userHighId: ZEBRA,
        rejectedFromUserId: ZEBRA,
        until: new Date(NOW.getTime() + DAY_MS),
      },
    ]);
  });

  it("is recipient-only: the sender cannot reject the invite back", async () => {
    ({ memory, store } = createStore({
      invites: [{ fromUserId: ALPHA, toUserId: ZEBRA }],
    }));

    const result = await rejectFriendInvite({ fromUserId: ZEBRA, viewerId: ALPHA }, store);

    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(memory.invites).toEqual([{ fromUserId: ALPHA, toUserId: ZEBRA }]);
    expect(memory.cooldowns).toEqual([]);
    expect(memory.writes).toEqual([]);
  });

  it("returns the closed NOT_FOUND without a cooldown when no pending row exists", async () => {
    const result = await rejectFriendInvite({ fromUserId: ALPHA, viewerId: ZEBRA }, store);

    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(memory.cooldowns).toEqual([]);
    expect(memory.writes).toEqual([]);
  });

  it("refuses rejection when the pair is blocked and writes no cooldown row", async () => {
    ({ memory, store } = createStore({
      invites: [{ fromUserId: ALPHA, toUserId: ZEBRA }],
      blocks: [{ blockerId: ALPHA, blockedId: ZEBRA }],
    }));

    const result = await rejectFriendInvite({ fromUserId: ALPHA, viewerId: ZEBRA }, store);

    expect(result).toEqual({ ok: false, code: "FORBIDDEN" });
    expect(memory.invites).toEqual([{ fromUserId: ALPHA, toUserId: ZEBRA }]);
    expect(memory.cooldowns).toEqual([]);
    expect(memory.writes).toEqual([]);
  });

  it("answers NOT_FOUND for a self pair without touching the store", async () => {
    const result = await rejectFriendInvite({ fromUserId: ALPHA, viewerId: ALPHA }, store);

    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(memory.transactions).toBe(0);
    expect(memory.writes).toEqual([]);
  });
});

describe("invite cooldown across reject and send", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("refuses a repeat for 24 hours and allows it once until has passed", async () => {
    useNow(NOW);
    const { memory, store } = createStore({
      invites: [{ fromUserId: ALPHA, toUserId: ZEBRA }],
    });

    await rejectFriendInvite({ fromUserId: ALPHA, viewerId: ZEBRA }, store);

    vi.setSystemTime(new Date(NOW.getTime() + 60 * 60 * 1000));
    const early = await sendFriendInvite({ fromUserId: ALPHA, toUserId: ZEBRA }, store);
    expect(early).toEqual({
      ok: false,
      code: "RATE_LIMITED",
      reason: "INVITE_COOLDOWN",
      hours: 23,
    });
    expect(memory.invites).toEqual([]);
    expect(memory.cooldowns).toHaveLength(1);

    vi.setSystemTime(new Date(NOW.getTime() + DAY_MS));
    const late = await sendFriendInvite({ fromUserId: ALPHA, toUserId: ZEBRA }, store);
    expect(late).toEqual({ ok: true, outcome: "INVITED" });
    expect(memory.invites).toEqual([{ fromUserId: ALPHA, toUserId: ZEBRA }]);
    expect(memory.cooldowns).toEqual([]);
  });

  it("blocks both sides of the pair during the window, not only the rejected sender", async () => {
    useNow(NOW);
    const { memory, store } = createStore({
      invites: [{ fromUserId: ALPHA, toUserId: ZEBRA }],
    });

    await rejectFriendInvite({ fromUserId: ALPHA, viewerId: ZEBRA }, store);
    vi.setSystemTime(new Date(NOW.getTime() + 12 * 60 * 60 * 1000));

    const fromRecipient = await sendFriendInvite({ fromUserId: ZEBRA, toUserId: ALPHA }, store);

    expect(fromRecipient).toEqual({
      ok: false,
      code: "RATE_LIMITED",
      reason: "INVITE_COOLDOWN",
      hours: 12,
    });
    expect(memory.invites).toEqual([]);
  });

  it("accepting an invite clears a cooldown left for the pair", async () => {
    useNow(NOW);
    const { memory, store } = createStore({
      invites: [{ fromUserId: ALPHA, toUserId: ZEBRA }],
      cooldowns: [{ ...pairOf(), rejectedFromUserId: ALPHA, until: new Date(NOW.getTime() + DAY_MS) }],
    });

    const result = await acceptFriendInvite({ fromUserId: ALPHA, viewerId: ZEBRA }, store);

    expect(result).toEqual({ ok: true, outcome: "FRIENDS_CREATED" });
    expect(memory.cooldowns).toEqual([]);
    const again = await sendFriendInvite({ fromUserId: ZEBRA, toUserId: ALPHA }, store);
    expect(again).toEqual({ ok: true, outcome: "ALREADY_FRIENDS" });
  });

  it("serializes a concurrent reject and repeat send on the same pair lock", async () => {
    useNow(NOW);
    const serialized = createSerializedStore({
      invites: [{ fromUserId: ALPHA, toUserId: ZEBRA }],
    });

    const results = await Promise.all([
      rejectFriendInvite({ fromUserId: ALPHA, viewerId: ZEBRA }, serialized.store),
      sendFriendInvite({ fromUserId: ALPHA, toUserId: ZEBRA }, serialized.store),
    ]);

    expect(results).toEqual([
      { ok: true, outcome: "REJECTED" },
      { ok: false, code: "RATE_LIMITED", reason: "INVITE_COOLDOWN", hours: 24 },
    ]);
    expect(serialized.memory.locks).toEqual([
      { userLowId: ALPHA, userHighId: ZEBRA },
      { userLowId: ALPHA, userHighId: ZEBRA },
    ]);
    expect(serialized.memory.invites).toEqual([]);
    expect(serialized.memory.cooldowns).toHaveLength(1);
  });
});
