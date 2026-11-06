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
};

/** In-memory protocol store: no database, but the same closed port the adapter implements. */
function createStore(seed: Partial<Memory> = {}) {
  const memory: Memory = {
    invites: [],
    friendships: [],
    blocks: [],
    transactions: 0,
    writes: [],
    ...seed,
  };

  const store: FriendshipStore = {
    async transaction(work) {
      memory.transactions += 1;
      const tx: FriendshipTransaction = {
        async hasBlockBetween(firstUserId, secondUserId) {
          return memory.blocks.some(
            (block) =>
              (block.blockerId === firstUserId && block.blockedId === secondUserId) ||
              (block.blockerId === secondUserId && block.blockedId === firstUserId),
          );
        },
        async findFriendship(pair) {
          return memory.friendships.some(
            (edge) => edge.userLowId === pair.userLowId && edge.userHighId === pair.userHighId,
          );
        },
        async findPendingInvite(fromUserId, toUserId) {
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
});
