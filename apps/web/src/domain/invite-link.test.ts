import { describe, expect, it } from "vitest";
import type { FriendshipPair } from "@/domain/friendship";
import {
  acceptInviteLink,
  acceptInviteLinkInTransaction,
  readInviteLinkState,
  type InviteLinkOwner,
  type InviteLinkReader,
  type InviteLinkStore,
  type InviteLinkTransaction,
} from "@/domain/invite-link";

type Invite = { readonly fromUserId: string; readonly toUserId: string };
type Block = { readonly blockerId: string; readonly blockedId: string };
type Cooldown = FriendshipPair & { readonly rejectedFromUserId: string; readonly until: Date };

type Memory = {
  owners: Map<string, InviteLinkOwner>;
  friendships: FriendshipPair[];
  invites: Invite[];
  blocks: Block[];
  cooldowns: Cooldown[];
  transactions: number;
  writes: string[];
  locks: FriendshipPair[];
  trace: string[];
};

/**
 * In-memory invite-link store: no database, but the same closed port the Prisma
 * adapter implements. `writes` is the whole proof of «ничего не записано» in the
 * refusal rows of the matrix.
 */
function createStore(seed: Partial<Memory> = {}) {
  const memory: Memory = {
    owners: new Map(),
    friendships: [],
    invites: [],
    blocks: [],
    cooldowns: [],
    transactions: 0,
    writes: [],
    locks: [],
    trace: [],
    ...seed,
  };

  const reader: InviteLinkReader = {
    async findOwnerByToken(token) {
      memory.trace.push("owner");
      return memory.owners.get(token) ?? null;
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
  };

  const store: InviteLinkStore = {
    ...reader,
    async transaction(work) {
      memory.transactions += 1;
      const tx: InviteLinkTransaction = {
        ...reader,
        async lockPair(pair) {
          memory.locks.push(pair);
          memory.trace.push("lock");
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
 * The same store behind a promise chain, so two accepts run one after another the
 * way the PostgreSQL pair lock orders them. The chain only simulates the lock;
 * the real serialization proof is the disposable-PostgreSQL test.
 */
function createSerializedStore(seed: Partial<Memory> = {}) {
  const base = createStore(seed);
  let tail: Promise<unknown> = Promise.resolve();

  const store: InviteLinkStore = {
    ...base.store,
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

const VIEWER = "alpha_viewer";
const OWNER = "zebra_owner";
const TOKEN = "invite_token_1";
const DAY_MS = 24 * 60 * 60 * 1000;

function ownerOf(id: string): InviteLinkOwner {
  return { id, displayName: `Имя ${id}`, nick: id };
}

function liveLink(id: string = OWNER, token: string = TOKEN): Map<string, InviteLinkOwner> {
  return new Map([[token, ownerOf(id)]]);
}

function pairOf(): FriendshipPair {
  return { userLowId: VIEWER, userHighId: OWNER };
}

describe("readInviteLinkState", () => {
  it("offers the confirmation to a stranger without writing anything", async () => {
    const { memory, store } = createStore({ owners: liveLink() });

    const preview = await readInviteLinkState(store, { viewerId: VIEWER, token: TOKEN });

    expect(preview).toEqual({ state: "can_accept", owner: ownerOf(OWNER) });
    expect(memory.writes).toEqual([]);
    expect(memory.transactions).toBe(0);
    expect(memory.trace).toEqual(["owner", "block", "friendship"]);
  });

  it("answers self for the owner's own token", async () => {
    const { memory, store } = createStore({ owners: liveLink() });

    const preview = await readInviteLinkState(store, { viewerId: OWNER, token: TOKEN });

    expect(preview).toEqual({ state: "self", owner: ownerOf(OWNER) });
    expect(memory.writes).toEqual([]);
    expect(memory.trace).not.toContain("block");
  });

  it("answers friends when the pair already has an edge", async () => {
    const { memory, store } = createStore({ owners: liveLink(), friendships: [pairOf()] });

    const preview = await readInviteLinkState(store, { viewerId: VIEWER, token: TOKEN });

    expect(preview).toEqual({ state: "friends", owner: ownerOf(OWNER) });
    expect(memory.writes).toEqual([]);
    expect(memory.friendships).toHaveLength(1);
  });

  it("answers not_found without a name for an unknown token", async () => {
    const { memory, store } = createStore({ owners: liveLink() });

    const preview = await readInviteLinkState(store, { viewerId: VIEWER, token: "nonsense" });

    expect(preview).toEqual({ state: "not_found" });
    expect(memory.trace).toEqual(["owner"]);
    expect(memory.writes).toEqual([]);
  });

  it("answers not_found for a block in either direction and never names the owner", async () => {
    for (const block of [
      { blockerId: OWNER, blockedId: VIEWER },
      { blockerId: VIEWER, blockedId: OWNER },
    ]) {
      const { memory, store } = createStore({ owners: liveLink(), blocks: [block] });

      const preview = await readInviteLinkState(store, { viewerId: VIEWER, token: TOKEN });

      // Exactly the answer of an unknown token: no owner, no id, no discriminator.
      expect(preview).toEqual({ state: "not_found" });
      expect(memory.writes).toEqual([]);
      expect(memory.transactions).toBe(0);
    }
  });
});

describe("acceptInviteLink", () => {
  it("creates the single ordered edge, drops the pair invites and touches no cooldown", async () => {
    const { memory, store } = createStore({
      owners: liveLink(),
      invites: [
        { fromUserId: VIEWER, toUserId: OWNER },
        { fromUserId: OWNER, toUserId: VIEWER },
      ],
      cooldowns: [
        { ...pairOf(), rejectedFromUserId: VIEWER, until: new Date(Date.now() + DAY_MS) },
      ],
    });

    const result = await acceptInviteLink({ viewerId: VIEWER, token: TOKEN }, store);

    expect(result).toEqual({ ok: true, outcome: "FRIENDS", owner: ownerOf(OWNER) });
    expect(memory.transactions).toBe(1);
    expect(memory.trace[0]).toBe("owner");
    expect(memory.locks).toEqual([pairOf()]);
    expect(memory.trace).toEqual(["owner", "lock", "block", "friendship"]);
    expect(memory.friendships).toEqual([pairOf()]);
    expect(memory.invites).toEqual([]);
    expect(memory.writes).toEqual(["friendship", "delete-invites"]);
    expect(memory.cooldowns).toHaveLength(1);
    expect(memory.trace).not.toContain("cooldown-read");
  });

  it("orders the edge as userLowId < userHighId from the viewer's side too", async () => {
    const { memory, store } = createStore({
      owners: liveLink(VIEWER, TOKEN),
      friendships: [],
    });
    // The owner's id sorts lower than the viewer's here: the edge is still the
    // canonical pair and not the direction of the click.
    const result = await acceptInviteLink({ viewerId: OWNER, token: TOKEN }, store);

    expect(result).toEqual({ ok: true, outcome: "FRIENDS", owner: ownerOf(VIEWER) });
    expect(memory.friendships).toEqual([{ userLowId: VIEWER, userHighId: OWNER }]);
  });

  it("answers ALREADY_FRIENDS without a second edge and without any write", async () => {
    const { memory, store } = createStore({
      owners: liveLink(),
      friendships: [pairOf()],
      invites: [{ fromUserId: OWNER, toUserId: VIEWER }],
    });

    const result = await acceptInviteLink({ viewerId: VIEWER, token: TOKEN }, store);

    expect(result).toEqual({ ok: true, outcome: "ALREADY_FRIENDS", owner: ownerOf(OWNER) });
    expect(memory.friendships).toEqual([pairOf()]);
    expect(memory.invites).toEqual([{ fromUserId: OWNER, toUserId: VIEWER }]);
    expect(memory.writes).toEqual([]);
  });

  it("refuses the owner's own token with FORBIDDEN before the pair lock", async () => {
    const { memory, store } = createStore({ owners: liveLink() });

    const result = await acceptInviteLink({ viewerId: OWNER, token: TOKEN }, store);

    expect(result).toEqual({ ok: false, code: "FORBIDDEN" });
    expect(memory.locks).toEqual([]);
    expect(memory.writes).toEqual([]);
  });

  it("answers NOT_FOUND for an unknown token", async () => {
    const { memory, store } = createStore({ owners: liveLink() });

    const result = await acceptInviteLink({ viewerId: VIEWER, token: "nonsense" }, store);

    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(memory.locks).toEqual([]);
    expect(memory.writes).toEqual([]);
    expect(memory.transactions).toBe(1);
  });

  it("answers NOT_FOUND, never FORBIDDEN, for a block in either direction", async () => {
    for (const block of [
      { blockerId: OWNER, blockedId: VIEWER },
      { blockerId: VIEWER, blockedId: OWNER },
    ]) {
      const { memory, store } = createStore({
        owners: liveLink(),
        blocks: [block],
        // Even a stale edge-side invitation must survive the refusal.
        invites: [{ fromUserId: OWNER, toUserId: VIEWER }],
      });

      const result = await acceptInviteLink({ viewerId: VIEWER, token: TOKEN }, store);

      expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
      expect(memory.friendships).toEqual([]);
      expect(memory.invites).toEqual([{ fromUserId: OWNER, toUserId: VIEWER }]);
      expect(memory.writes).toEqual([]);
    }
  });

  it("serializes two simultaneous accepts into one edge", async () => {
    const serialized = createSerializedStore({ owners: liveLink() });

    const results = await Promise.all([
      acceptInviteLink({ viewerId: VIEWER, token: TOKEN }, serialized.store),
      acceptInviteLink({ viewerId: VIEWER, token: TOKEN }, serialized.store),
    ]);

    expect(results).toEqual([
      { ok: true, outcome: "FRIENDS", owner: ownerOf(OWNER) },
      { ok: true, outcome: "ALREADY_FRIENDS", owner: ownerOf(OWNER) },
    ]);
    expect(serialized.memory.transactions).toBe(2);
    expect(serialized.memory.locks).toEqual([pairOf(), pairOf()]);
    expect(serialized.memory.friendships).toEqual([pairOf()]);
  });
});

describe("acceptInviteLinkInTransaction", () => {
  it("needs no token lookup and writes the edge for an already resolved owner", async () => {
    const { memory, store } = createStore();

    const result = await store.transaction((tx) =>
      acceptInviteLinkInTransaction({ viewerId: VIEWER, owner: ownerOf(OWNER) }, tx),
    );

    expect(result).toEqual({ ok: true, outcome: "FRIENDS", owner: ownerOf(OWNER) });
    expect(memory.trace).not.toContain("owner");
    expect(memory.writes).toEqual(["friendship", "delete-invites"]);
  });

  it("keeps the edge of a friendship that appeared in the same transaction", async () => {
    const { memory, store } = createStore({ friendships: [pairOf()] });
    // A friend is not a refusal: the registration path must not fail on it.
    const result = await store.transaction((tx) =>
      acceptInviteLinkInTransaction({ viewerId: VIEWER, owner: ownerOf(OWNER) }, tx),
    );

    expect(result).toEqual({ ok: true, outcome: "ALREADY_FRIENDS", owner: ownerOf(OWNER) });
    expect(memory.writes).toEqual([]);
  });
});
