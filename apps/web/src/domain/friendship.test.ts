import { beforeEach, describe, expect, it } from "vitest";
import {
  orderFriendPair,
  sendFriendInvite,
  type FriendshipPair,
  type FriendshipStore,
  type FriendshipTransaction,
} from "@/domain/friendship";

type Invite = { readonly fromUserId: string; readonly toUserId: string };
type Block = { readonly blockerId: string; readonly blockedId: string };

type Memory = {
  invites: Invite[];
  friendships: FriendshipPair[];
  blocks: Block[];
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
    expect(memory.writes).toEqual(["friendship", "delete-invites"]);
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
