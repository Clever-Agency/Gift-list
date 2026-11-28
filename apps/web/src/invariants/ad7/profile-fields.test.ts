// AD-7 (ред. 2026-11-26, D-58, FR-54, FR-55) / AD-29: somebody's profile fields
// leave the server only for the owner and for an accepted friend of an owner who
// opened `profileVisibleToFriends`. This check goes through the use-case
// `getProfileByNick` — the one gate of `/u/:nick` — with only the database faked,
// so a widened read or a forgotten policy step shows up as a leaked value.
//
// The canonical per-piece tests stay where they are: `domain/profile-details.test.ts`
// (the policy and the mapper), `app/api/v1/u/[[...nick]]/route.test.ts` (the wire
// answer) and `actions/profile.ts` (the use-case). What none of them has is the
// matrix crowd at the use-case level, including a Block in either direction with
// a stale friendship still on record.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type FriendPair = { userLowId: string; userHighId: string };

const { state, prisma, getSession } = vi.hoisted(() => {
  const state = {
    actor: null as string | null,
    users: [] as { id: string; name: string; nick: string; nickNormalized: string }[],
    owner: null as null | {
      birthDay: number | null;
      birthMonth: number | null;
      gender: "MALE" | "FEMALE" | null;
      country: string | null;
      about: string | null;
      profileVisibleToFriends: boolean;
    },
    friendships: new Set<string>(),
    invitations: [] as { fromUserId: string; toUserId: string }[],
    blocks: [] as { blockerId: string; blockedId: string }[],
    subscriptions: [] as { subscriberId: string; targetId: string }[],
  };

  function pairKey(pair: FriendPair): string {
    return `${pair.userLowId}\u0000${pair.userHighId}`;
  }

  const prisma = {
    user: {
      async findUnique(args: { where: { nickNormalized: string } }) {
        const user = state.users.find((row) => row.nickNormalized === args.where.nickNormalized);
        return user === undefined || state.owner === null ? null : { ...user, ...state.owner };
      },
    },
    list: {
      async findUnique(args: { where: { ownerId?: string; publicToken?: string } }) {
        if (args.where.ownerId !== undefined) {
          const owner = state.users.find((row) => row.id === args.where.ownerId);
          if (owner === undefined) return null;
          return {
            id: "l1",
            ownerId: owner.id,
            publicToken: "tok-1",
            owner: { name: owner.name, nick: owner.nick },
          };
        }
        return null;
      },
    },
    gift: {
      async findMany() {
        return [];
      },
      async count() {
        return 0;
      },
    },
    userDate: {
      async findMany() {
        return [];
      },
    },
    friendship: {
      async findUnique(args: { where: { userLowId_userHighId: FriendPair } }) {
        const key = pairKey(args.where.userLowId_userHighId);
        return state.friendships.has(key) ? { id: "f1" } : null;
      },
    },
    friendshipInvite: {
      async findUnique(args: { where: { fromUserId_toUserId: { fromUserId: string; toUserId: string } } }) {
        const where = args.where.fromUserId_toUserId;
        return state.invitations.some(
          (row) => row.fromUserId === where.fromUserId && row.toUserId === where.toUserId,
        )
          ? { id: "i1" }
          : null;
      },
    },
    inviteCooldown: {
      async findUnique() {
        return null;
      },
    },
    block: {
      async findFirst(args: {
        where: { OR: { blockerId: string; blockedId: string }[] };
      }) {
        const found = state.blocks.some((block) =>
          args.where.OR.some(
            (row) => row.blockerId === block.blockerId && row.blockedId === block.blockedId,
          ),
        );
        return found ? { id: "b1" } : null;
      },
    },
    subscription: {
      async findUnique(args: { where: { subscriberId_targetId: { subscriberId: string; targetId: string } } }) {
        const where = args.where.subscriberId_targetId;
        return state.subscriptions.some(
          (row) => row.subscriberId === where.subscriberId && row.targetId === where.targetId,
        )
          ? { id: "s1" }
          : null;
      },
    },
    async $transaction(operations: Promise<unknown>[]) {
      return Promise.all(operations);
    },
  };

  const getSession = vi.fn(async function currentSession() {
    return state.actor === null ? null : { user: { id: state.actor }, session: { token: "t" } };
  });

  return { state, prisma, getSession };
});

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({ prisma }));

import type { ActionResult, ListData } from "@gift-list/contracts";
import { getProfileByNick } from "@/actions/profile";
import { orderFriendPair } from "@/domain/friendship";

const OWNER = "u1";
const VIEWER = "u9";
const headers = new Headers({ "accept-language": "ru-RU,ru;q=0.9" });

const ANNA_DETAILS = {
  birthDay: 14,
  birthMonth: 6,
  gender: "FEMALE" as const,
  country: "BY",
  about: "Люблю походы и книги.",
};

const DETAIL_KEYS = ["about", "birthDay", "birthMonth", "country", "gender"];
const OWN_KEYS = [...DETAIL_KEYS, "profileVisibleToFriends"].sort();

function addFriendship(first: string, second: string): void {
  const pair = orderFriendPair(first, second);
  state.friendships.add(`${pair.userLowId}\u0000${pair.userHighId}`);
}

function openProfile(visitor: string | null = VIEWER): Promise<ActionResult<ListData>> {
  state.actor = visitor;
  return getProfileByNick("Anna", headers);
}

function expectOk(result: ActionResult<ListData>): ListData {
  if (!result.ok) throw new Error(`unexpected error: ${result.code}`);
  return result.data;
}

function expectClosed(result: ActionResult<ListData>): void {
  expect(result).toEqual({ ok: false, code: "NOT_FOUND", message: "Not found" });
}

beforeEach(() => {
  getSession.mockClear();
  state.actor = null;
  state.users = [{ id: OWNER, name: "Анна", nick: "Anna", nickNormalized: "anna" }];
  state.owner = { ...ANNA_DETAILS, profileVisibleToFriends: true };
  state.friendships = new Set<string>();
  state.invitations = [];
  state.blocks = [];
  state.subscriptions = [];
});

describe("AD-7 (профиль) — поля профиля не утекают посторонним", () => {
  it("сам видит поля всегда и вместе с переключателем", async () => {
    const open = expectOk(await openProfile(OWNER));

    expect(open.details).toEqual({ ...ANNA_DETAILS, profileVisibleToFriends: true });
    expect(Object.keys(open.details ?? {}).sort()).toEqual(OWN_KEYS);

    if (state.owner === null) throw new Error("expected an owner fixture");
    state.owner.profileVisibleToFriends = false;
    const closed = expectOk(await openProfile(OWNER));

    expect(closed.details).toEqual({ ...ANNA_DETAILS, profileVisibleToFriends: false });
  });

  it("друг при включённом переключателе видит пять полей и не видит переключатель", async () => {
    addFriendship(VIEWER, OWNER);

    const data = expectOk(await openProfile());

    expect(data.details).toEqual(ANNA_DETAILS);
    expect(Object.keys(data.details ?? {}).sort()).toEqual(DETAIL_KEYS);
    expect(JSON.stringify(data)).not.toContain("profileVisibleToFriends");
  });

  it("друг при выключенном переключателе не получает блока", async () => {
    addFriendship(VIEWER, OWNER);
    if (state.owner === null) throw new Error("expected an owner fixture");
    state.owner.profileVisibleToFriends = false;

    const data = expectOk(await openProfile());

    expect(data).not.toHaveProperty("details");
    expect(JSON.stringify(data)).not.toContain(ANNA_DETAILS.about);
    expect(JSON.stringify(data)).not.toContain("profileVisibleToFriends");
  });

  it("подписчик без дружбы не получает полей", async () => {
    state.subscriptions = [{ subscriberId: VIEWER, targetId: OWNER }];

    const data = expectOk(await openProfile());

    expect(data).not.toHaveProperty("details");
    expect(JSON.stringify(data)).not.toContain(ANNA_DETAILS.about);
  });

  it("не-друг не получает полей", async () => {
    const data = expectOk(await openProfile());

    expect(data).not.toHaveProperty("details");
    expect(JSON.stringify(data)).not.toContain(ANNA_DETAILS.about);
  });

  it("аноним не получает полей", async () => {
    const result = await openProfile(null);

    expect(result).toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
    expect(JSON.stringify(result)).not.toContain(ANNA_DETAILS.about);
    expect(JSON.stringify(result)).not.toContain("details");
  });

  it("Block в любую сторону — тот же закрытый 404 и ни одного поля", async () => {
    // A stale accepted friendship must not survive a Block: the gate is checked
    // before the profile rule (AD-7 step 2).
    addFriendship(VIEWER, OWNER);

    state.blocks = [{ blockerId: VIEWER, blockedId: OWNER }];
    const viewerBlocks = await openProfile();
    expectClosed(viewerBlocks);

    state.blocks = [{ blockerId: OWNER, blockedId: VIEWER }];
    const ownerBlocks = await openProfile();
    expectClosed(ownerBlocks);

    // The unknown nick is the same answer, so a Block explains nothing.
    state.actor = VIEWER;
    const unknown = await getProfileByNick("no-such-nick", headers);
    expect(ownerBlocks).toEqual(unknown);

    for (const result of [viewerBlocks, ownerBlocks, unknown]) {
      expect(JSON.stringify(result)).not.toContain(ANNA_DETAILS.about);
      expect(JSON.stringify(result)).not.toContain("details");
      expect(JSON.stringify(result)).not.toContain("profileVisibleToFriends");
    }
  });
});
