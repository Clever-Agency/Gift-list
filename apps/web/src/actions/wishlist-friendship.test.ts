import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * Isolated in-memory Prisma stand-in (Story 4.1.1). It implements only the
 * models this story reads and writes, so a query against a table that does not
 * exist in R1 (`Subscription`, `ContactMatch`) would fail the test instead of
 * silently returning "no relation".
 */
const fake = vi.hoisted(() => {
  type Invite = { fromUserId: string; toUserId: string };
  type Friendship = { userLowId: string; userHighId: string };
  type Block = { blockerId: string; blockedId: string };
  type Cooldown = {
    userLowId: string;
    userHighId: string;
    rejectedFromUserId: string;
    until: Date;
  };
  type ListRow = {
    id: string;
    ownerId: string;
    publicToken: string;
    owner: { name: string; nick: string };
  };
  type GiftRow = Record<string, unknown>;
  type PrismaLike = {
    list: { findUnique(args: { where: { ownerId?: string; publicToken?: string } }): Promise<ListRow | null> };
    gift: {
      findMany(args: {
        where: { listId: string; archivedAt: null; visibility?: { in: string[] } };
      }): Promise<GiftRow[]>;
    };
    friendshipInvite: {
      findUnique(args: {
        where: { fromUserId_toUserId: { fromUserId: string; toUserId: string } };
      }): Promise<{ id: string } | null>;
      create(args: { data: Invite }): Promise<{ id: string }>;
      deleteMany(args: {
        where: { OR: Invite[] } | Invite;
      }): Promise<{ count: number }>;
    };
    friendship: {
      findUnique(args: {
        where: { userLowId_userHighId: Friendship };
      }): Promise<{ id: string } | null>;
      create(args: { data: Friendship }): Promise<{ id: string }>;
    };
    inviteCooldown: {
      findUnique(args: {
        where: { userLowId_userHighId: Friendship };
      }): Promise<{ until: Date; rejectedFromUserId: string } | null>;
      upsert(args: {
        where: { userLowId_userHighId: Friendship };
        create: Cooldown;
        update: { rejectedFromUserId: string; until: Date };
      }): Promise<{ id: string }>;
      deleteMany(args: { where: Friendship }): Promise<{ count: number }>;
    };
    block: {
      findFirst(args: { where: { OR: Block[] } }): Promise<{ id: string } | null>;
    };
    $executeRaw(strings: TemplateStringsArray, ...values: unknown[]): Promise<number>;
    $transaction(
      work: (tx: PrismaLike) => Promise<unknown>,
      options?: { isolationLevel?: string },
    ): Promise<unknown>;
  };

  const state = {
    list: null as ListRow | null,
    gifts: [] as GiftRow[],
    invites: [] as Invite[],
    friendships: [] as Friendship[],
    blocks: [] as Block[],
    cooldowns: [] as Cooldown[],
    locks: [] as string[],
    lockStatements: [] as string[],
    transactionOptions: [] as { isolationLevel?: string }[],
  };

  const prisma: PrismaLike = {
    list: {
      async findUnique(args) {
        const { where } = args;
        if (state.list === null) return null;
        if (where.ownerId !== undefined) {
          return state.list.ownerId === where.ownerId ? state.list : null;
        }
        return state.list.publicToken === where.publicToken ? state.list : null;
      },
    },
    gift: {
      async findMany(args) {
        const { where } = args;
        return state.gifts.filter((gift) => {
          if (gift.listId !== where.listId) return false;
          if (gift.archivedAt !== null) return false;
          const allowed = where.visibility?.in;
          return allowed === undefined || allowed.includes(gift.visibility as string);
        });
      },
    },
    friendshipInvite: {
      async findUnique(args) {
        const { fromUserId, toUserId } = args.where.fromUserId_toUserId;
        const found = state.invites.find(
          (invite) => invite.fromUserId === fromUserId && invite.toUserId === toUserId,
        );
        return found ? { id: "invite_1" } : null;
      },
      async create(args) {
        state.invites.push({ ...args.data });
        return { id: "invite_1" };
      },
      async deleteMany(args) {
        const pairs = "OR" in args.where ? args.where.OR : [args.where];
        state.invites = state.invites.filter(
          (invite) =>
            !pairs.some(
              (pair) =>
                pair.fromUserId === invite.fromUserId && pair.toUserId === invite.toUserId,
            ),
        );
        return { count: 0 };
      },
    },
    friendship: {
      async findUnique(args) {
        const { userLowId, userHighId } = args.where.userLowId_userHighId;
        const found = state.friendships.find(
          (edge) => edge.userLowId === userLowId && edge.userHighId === userHighId,
        );
        return found ? { id: "friendship_1" } : null;
      },
      async create(args) {
        state.friendships.push({ ...args.data });
        return { id: "friendship_1" };
      },
    },
    inviteCooldown: {
      async findUnique(args) {
        const { userLowId, userHighId } = args.where.userLowId_userHighId;
        const found = state.cooldowns.find(
          (row) => row.userLowId === userLowId && row.userHighId === userHighId,
        );
        return found ? { until: found.until, rejectedFromUserId: found.rejectedFromUserId } : null;
      },
      async upsert(args) {
        const { userLowId, userHighId } = args.where.userLowId_userHighId;
        const existing = state.cooldowns.find(
          (row) => row.userLowId === userLowId && row.userHighId === userHighId,
        );
        if (existing !== undefined) {
          existing.rejectedFromUserId = args.update.rejectedFromUserId;
          existing.until = args.update.until;
        } else {
          state.cooldowns.push({ ...args.create });
        }
        return { id: "cooldown_1" };
      },
      async deleteMany(args) {
        const { userLowId, userHighId } = args.where;
        state.cooldowns = state.cooldowns.filter(
          (row) => !(row.userLowId === userLowId && row.userHighId === userHighId),
        );
        return { count: 0 };
      },
    },
    block: {
      async findFirst(args) {
        const pairs = args.where.OR;
        const found = state.blocks.find((block) =>
          pairs.some(
            (pair) => pair.blockerId === block.blockerId && pair.blockedId === block.blockedId,
          ),
        );
        return found ? { id: "block_1" } : null;
      },
    },
    async $executeRaw(strings, ...values) {
      state.lockStatements.push(strings.join("?"));
      state.locks.push(values.join(":"));
      return 1;
    },
    async $transaction(work, options) {
      state.transactionOptions.push(options ?? {});
      return work(prisma);
    },
  };

  return { state, prisma };
});

vi.mock("@/db/client", () => ({ prisma: fake.prisma }));

import { readWishlist } from "@/actions/wishlist-read";
import { sendFriendInvite } from "@/domain/friendship";
import { friendshipStore } from "@/lib/friendship-store";

const OWNER_ID = "owner_1";
const VIEWER_ID = "viewer_1";

function buildGift(id: string, visibility: "PUBLIC" | "FRIENDS" | "SECRET") {
  return {
    id,
    listId: "list_1",
    title: `Wish ${id}`,
    description: null,
    priceAmount: null,
    priceCurrency: null,
    linkUrl: null,
    visibility,
    quantity: "SINGLE",
    expiresOn: null,
    archivedAt: null,
    status: "OPEN",
    reservationPhase: null,
    reservationBought: false,
    holderVisibleToOwner: false,
    holderVisibleToOthers: true,
    reservedBy: null,
    tags: [],
  };
}

describe("readWishlist with the friendship protocol (AD-7, AD-10)", () => {
  beforeEach(() => {
    fake.state.list = {
      id: "list_1",
      ownerId: OWNER_ID,
      publicToken: "token_1",
      owner: { name: "Owner", nick: "owner" },
    };
    fake.state.gifts = [
      buildGift("gift_friends", "FRIENDS"),
      buildGift("gift_public", "PUBLIC"),
      buildGift("gift_secret", "SECRET"),
    ];
    fake.state.invites = [];
    fake.state.friendships = [];
    fake.state.blocks = [];
    fake.state.cooldowns = [];
    fake.state.locks = [];
    fake.state.lockStatements = [];
    fake.state.transactionOptions = [];
  });

  it("hides FRIENDS wishes while the invite is only pending", async () => {
    const sent = await sendFriendInvite(
      { fromUserId: VIEWER_ID, toUserId: OWNER_ID },
      friendshipStore,
    );
    expect(sent).toEqual({ ok: true, outcome: "INVITED" });

    const data = await readWishlist({
      viewer: { id: VIEWER_ID },
      target: { ownerId: OWNER_ID },
    });

    expect(data.access).toBe("gifts");
    expect(data.gifts).toEqual([]);
  });

  it("shows FRIENDS and PUBLIC wishes after the counter invite creates the edge", async () => {
    await sendFriendInvite({ fromUserId: VIEWER_ID, toUserId: OWNER_ID }, friendshipStore);
    const accepted = await sendFriendInvite(
      { fromUserId: OWNER_ID, toUserId: VIEWER_ID },
      friendshipStore,
    );
    expect(accepted).toEqual({ ok: true, outcome: "FRIENDS_CREATED" });
    // Both directions asked for the same canonical pair lock, with the blocking
    // statement the adapter must keep, and both transactions pinned to READ COMMITTED.
    expect(fake.state.locks).toEqual(["owner_1:viewer_1", "owner_1:viewer_1"]);
    expect(fake.state.lockStatements).toEqual([
      "SELECT pg_advisory_xact_lock(hashtextextended(?, 0))",
      "SELECT pg_advisory_xact_lock(hashtextextended(?, 0))",
    ]);
    expect(fake.state.transactionOptions).toEqual([
      { isolationLevel: "ReadCommitted" },
      { isolationLevel: "ReadCommitted" },
    ]);

    const data = await readWishlist({
      viewer: { id: VIEWER_ID },
      target: { ownerId: OWNER_ID },
    });

    expect(data.access).toBe("gifts");
    expect(data.gifts.map((gift) => gift.id).sort()).toEqual(["gift_friends", "gift_public"]);
    // A friendship never opens SECRET and never fakes a subscriber.
    expect(data.gifts.some((gift) => gift.id === "gift_secret")).toBe(false);
  });

  it("answers not_found when the owner blocked the viewer", async () => {
    fake.state.blocks.push({ blockerId: OWNER_ID, blockedId: VIEWER_ID });

    const data = await readWishlist({
      viewer: { id: VIEWER_ID },
      target: { ownerId: OWNER_ID },
    });

    expect(data).toEqual({ access: "not_found", gifts: [] });
  });
});
