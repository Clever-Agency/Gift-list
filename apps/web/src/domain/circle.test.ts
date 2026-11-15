import { describe, expect, it } from "vitest";
import { normalizeForSearch, type ProfileRelationship } from "@gift-list/contracts";
import {
  CIRCLE_PAGE_SIZE,
  compareCircleOrder,
  decodeCircleCursor,
  encodeCircleCursor,
  normalizeFriendQuery,
  readFriendsPage,
  readIncomingInvitesCount,
  readIncomingInvitesPage,
  readOutgoingInvitesPage,
  readSubscribersPage,
  readSubscriptionsPage,
  type CircleCandidate,
  type CirclePage,
  type CirclePageResult,
  type CircleReader,
} from "@/domain/circle";

const VIEWER = "viewer_user";

/** A row of one list, with the same closed shape the Prisma adapter answers. */
type MemberSeed = {
  readonly id: string;
  readonly displayName?: string;
  readonly nick?: string;
  readonly relationship?: ProfileRelationship;
  readonly subscribed?: boolean;
  readonly followsViewer?: boolean;
  readonly blocked?: boolean;
};

type FakeCircle = {
  friends: CircleCandidate[];
  subscriptions: CircleCandidate[];
  subscribers: CircleCandidate[];
  incoming: CircleCandidate[];
  outgoing: CircleCandidate[];
};

/** In-memory reader: no database, but the same closed port the adapter implements. */
function createReader(seed: Partial<FakeCircle> = {}): {
  circle: FakeCircle;
  reader: CircleReader;
} {
  const circle: FakeCircle = {
    friends: [],
    subscriptions: [],
    subscribers: [],
    incoming: [],
    outgoing: [],
    ...seed,
  };

  const reader: CircleReader = {
    async readFriends(viewerId) {
      expect(viewerId).toBe(VIEWER);
      return circle.friends;
    },
    async readSubscriptions(viewerId) {
      expect(viewerId).toBe(VIEWER);
      return circle.subscriptions;
    },
    async readSubscribers(viewerId) {
      expect(viewerId).toBe(VIEWER);
      return circle.subscribers;
    },
    async readIncomingInvites(viewerId) {
      expect(viewerId).toBe(VIEWER);
      return circle.incoming;
    },
    async readOutgoingInvites(viewerId) {
      expect(viewerId).toBe(VIEWER);
      return circle.outgoing;
    },
  };

  return { circle, reader };
}

function member(seed: MemberSeed): CircleCandidate {
  const displayName = seed.displayName ?? seed.id;
  return {
    id: seed.id,
    displayName,
    nick: seed.nick ?? displayName,
    nameNormalized: normalizeForSearch(displayName),
    relationship: seed.relationship ?? "FRIENDS",
    subscribed: seed.subscribed ?? false,
    followsViewer: seed.followsViewer ?? false,
    blocked: seed.blocked ?? false,
  };
}

function pageOf(result: CirclePageResult): CirclePage {
  if (!result.ok) throw new Error(`unexpected refusal: ${result.reason}`);
  return result;
}

function idsOf(page: CirclePage): string[] {
  return page.items.map(function idOf(row) {
    return row.id;
  });
}

/** `count` friends ordered by the alphabet: «Друг 01», «Друг 02», … */
function numberedFriends(count: number): CircleCandidate[] {
  return Array.from({ length: count }, function friendAt(_, index) {
    const number = String(index + 1).padStart(2, "0");
    return member({ id: `friend-${number}`, displayName: `Друг ${number}`, nick: `drug_${number}` });
  });
}

describe("normalizeFriendQuery", () => {
  it("trims, drops one optional leading @ and normalizes like the global search", () => {
    expect(normalizeFriendQuery("  @Алёна ")).toBe("алена");
    expect(normalizeFriendQuery("Алена")).toBe("алена");
    expect(normalizeFriendQuery("Йога")).toBe("йога");
    expect(normalizeFriendQuery("@@anna")).toBe("@anna");
    expect(normalizeFriendQuery("   ")).toBe("");
    expect(normalizeFriendQuery("@")).toBe("");
  });
});

describe("circle cursor", () => {
  it("round-trips the stable pair and splits at the last separator", () => {
    expect(encodeCircleCursor({ nameNormalized: "алена", id: "cuid2abc" })).toBe("алена|cuid2abc");
    expect(decodeCircleCursor("алена|cuid2abc")).toEqual({ nameNormalized: "алена", id: "cuid2abc" });
    expect(decodeCircleCursor(encodeCircleCursor({ nameNormalized: "а|б", id: "x" }))).toEqual({
      nameNormalized: "а|б",
      id: "x",
    });
  });

  it("answers null for anything it did not issue", () => {
    expect(decodeCircleCursor("")).toBeNull();
    expect(decodeCircleCursor("мусор")).toBeNull();
    expect(decodeCircleCursor("алена|")).toBeNull();
  });

  it("orders by nameNormalized and then by id, without a locale", () => {
    expect(compareCircleOrder({ nameNormalized: "а", id: "b" }, { nameNormalized: "б", id: "a" })).toBe(-1);
    expect(compareCircleOrder({ nameNormalized: "а", id: "b" }, { nameNormalized: "а", id: "a" })).toBe(1);
    expect(compareCircleOrder({ nameNormalized: "а", id: "a" }, { nameNormalized: "а", id: "a" })).toBe(0);
  });
});

describe("readFriendsPage", () => {
  it("pages 15 rows with a stable cursor and the full total", async () => {
    const { reader } = createReader({ friends: numberedFriends(17) });

    const first = pageOf(await readFriendsPage(reader, { viewerId: VIEWER }));
    expect(first.total).toBe(17);
    expect(first.items).toHaveLength(CIRCLE_PAGE_SIZE);
    expect(idsOf(first)).toEqual(numberedFriends(15).map((row) => row.id));
    expect(first.nextCursor).toBe("друг 15|friend-15");

    const second = pageOf(
      await readFriendsPage(reader, { viewerId: VIEWER, cursor: first.nextCursor }),
    );
    expect(second.total).toBe(17);
    expect(idsOf(second)).toEqual(["friend-16", "friend-17"]);
    expect(second.nextCursor).toBeNull();
  });

  it("never skips or repeats a row when nameNormalized is identical", async () => {
    const sameName = Array.from({ length: 30 }, function friendAt(_, index) {
      const id = `id-${String(index).padStart(2, "0")}`;
      return member({ id, displayName: "Одинаково", nick: `nick_${index}` });
    });
    const { reader } = createReader({ friends: sameName });

    const first = pageOf(await readFriendsPage(reader, { viewerId: VIEWER }));
    const second = pageOf(
      await readFriendsPage(reader, { viewerId: VIEWER, cursor: first.nextCursor }),
    );

    expect(first.total).toBe(30);
    expect(first.nextCursor).toBe("одинаково|id-14");
    expect(second.total).toBe(30);
    expect(second.nextCursor).toBeNull();
    expect(idsOf(second)).toHaveLength(15);
    expect(new Set([...idsOf(first), ...idsOf(second)])).toEqual(
      new Set(sameName.map((row) => row.id)),
    );
  });

  it("searches by display name without ё, by nick with or without @, and keeps й apart from и", async () => {
    const { reader } = createReader({
      friends: [
        member({ id: "alenka", displayName: "Алёна", nick: "alena" }),
        member({ id: "yoga", displayName: "Йога", nick: "yoga" }),
        member({ id: "ioga", displayName: "Иога", nick: "ioga" }),
      ],
    });

    const byYo = pageOf(await readFriendsPage(reader, { viewerId: VIEWER, q: "Алена" }));
    expect(idsOf(byYo)).toEqual(["alenka"]);
    expect(byYo.total).toBe(1);

    const byNick = pageOf(await readFriendsPage(reader, { viewerId: VIEWER, q: "alen" }));
    expect(idsOf(byNick)).toEqual(["alenka"]);

    const byAtNick = pageOf(await readFriendsPage(reader, { viewerId: VIEWER, q: " @alena " }));
    expect(idsOf(byAtNick)).toEqual(["alenka"]);

    const byShortI = pageOf(await readFriendsPage(reader, { viewerId: VIEWER, q: "иога" }));
    expect(idsOf(byShortI)).toEqual(["ioga"]);

    const byY = pageOf(await readFriendsPage(reader, { viewerId: VIEWER, q: "йога" }));
    expect(idsOf(byY)).toEqual(["yoga"]);
  });

  it("searches the whole circle, not only the first page", async () => {
    const { reader } = createReader({
      friends: [...numberedFriends(20), member({ id: "apple", displayName: "Яблоко", nick: "yabloko" })],
    });

    const firstPage = pageOf(await readFriendsPage(reader, { viewerId: VIEWER }));
    expect(firstPage.items).toHaveLength(CIRCLE_PAGE_SIZE);
    expect(idsOf(firstPage)).not.toContain("apple");

    const found = pageOf(await readFriendsPage(reader, { viewerId: VIEWER, q: "ябло" }));
    expect(idsOf(found)).toEqual(["apple"]);
    expect(found.total).toBe(1);
    expect(found.nextCursor).toBeNull();
  });

  it("answers a full page for an empty query and an empty page for no matches", async () => {
    const { reader } = createReader({ friends: numberedFriends(3) });

    const all = pageOf(await readFriendsPage(reader, { viewerId: VIEWER, q: "   " }));
    expect(all.total).toBe(3);
    expect(all.items).toHaveLength(3);
    expect(all.nextCursor).toBeNull();

    const none = pageOf(await readFriendsPage(reader, { viewerId: VIEWER, q: "никого" }));
    expect(none).toEqual({ ok: true, items: [], nextCursor: null, total: 0 });

    const empty = pageOf(await readFriendsPage(createReader().reader, { viewerId: VIEWER }));
    expect(empty).toEqual({ ok: true, items: [], nextCursor: null, total: 0 });
  });

  it("keeps a friend hidden from the global search in the list and in its search", async () => {
    const hidden: CircleCandidate & { readonly hideFromSearch: boolean } = {
      ...member({ id: "hidden", displayName: "Скрытая", nick: "hidden" }),
      hideFromSearch: true,
    };
    const { reader } = createReader({ friends: [hidden] });

    const all = pageOf(await readFriendsPage(reader, { viewerId: VIEWER }));
    expect(idsOf(all)).toEqual(["hidden"]);

    const found = pageOf(await readFriendsPage(reader, { viewerId: VIEWER, q: "скры" }));
    expect(idsOf(found)).toEqual(["hidden"]);
  });

  it("refuses a cursor it did not issue instead of restarting from the first row", async () => {
    const { reader } = createReader({ friends: numberedFriends(3) });

    const result = await readFriendsPage(reader, { viewerId: VIEWER, cursor: "мусор" });

    expect(result).toEqual({ ok: false, code: "VALIDATION", reason: "INVALID_CURSOR" });
  });
});

describe("subscription lists", () => {
  it("keeps the viewer's own subscriptions apart from the viewer's subscribers", async () => {
    const { reader } = createReader({
      subscriptions: [member({ id: "followed", relationship: "NONE", subscribed: true })],
      subscribers: [member({ id: "follower", relationship: "NONE", followsViewer: true })],
    });

    const following = pageOf(await readSubscriptionsPage(reader, { viewerId: VIEWER, cursor: null }));
    expect(idsOf(following)).toEqual(["followed"]);
    expect(following.items[0]).toMatchObject({ subscribed: true, followsViewer: false });

    const followers = pageOf(await readSubscribersPage(reader, { viewerId: VIEWER, cursor: null }));
    expect(idsOf(followers)).toEqual(["follower"]);
    expect(followers.items[0]).toMatchObject({ subscribed: false, followsViewer: true });
  });
});

describe("invite lists", () => {
  it("keeps incoming and outgoing invites apart and counts every incoming for the badge", async () => {
    const { reader } = createReader({
      incoming: [
        member({ id: "in-a", relationship: "INCOMING_PENDING" }),
        member({ id: "in-b", relationship: "INCOMING_PENDING" }),
        member({ id: "in-c", relationship: "INCOMING_PENDING" }),
      ],
      outgoing: [
        member({ id: "out-a", relationship: "OUTGOING_PENDING" }),
        member({ id: "out-b", relationship: "OUTGOING_PENDING" }),
      ],
    });

    const incoming = pageOf(await readIncomingInvitesPage(reader, { viewerId: VIEWER }));
    expect(incoming.total).toBe(3);
    expect(idsOf(incoming)).toEqual(["in-a", "in-b", "in-c"]);

    const outgoing = pageOf(await readOutgoingInvitesPage(reader, { viewerId: VIEWER }));
    expect(outgoing.total).toBe(2);
    expect(idsOf(outgoing)).toEqual(["out-a", "out-b"]);

    expect(await readIncomingInvitesCount(reader, VIEWER)).toBe(3);
  });

  it("counts the whole incoming list, not one page", async () => {
    const many = Array.from({ length: 20 }, function inviteAt(_, index) {
      const number = String(index + 1).padStart(2, "0");
      return member({ id: `in-${number}`, displayName: `Гость ${number}` });
    });
    const { reader } = createReader({ incoming: many });

    const page = pageOf(await readIncomingInvitesPage(reader, { viewerId: VIEWER }));
    expect(page.items).toHaveLength(CIRCLE_PAGE_SIZE);
    expect(page.total).toBe(20);
    expect(await readIncomingInvitesCount(reader, VIEWER)).toBe(20);
  });
});

describe("blocked pairs", () => {
  it("drops a blocked person from every circle list", async () => {
    const blocked = { blocked: true } as const;
    const { reader } = createReader({
      friends: [member({ id: "blocked-friend", ...blocked }), member({ id: "friend" })],
      subscriptions: [member({ id: "blocked-follow", ...blocked })],
      subscribers: [member({ id: "blocked-follower", ...blocked })],
      incoming: [member({ id: "blocked-inviter", ...blocked })],
      outgoing: [member({ id: "blocked-target", ...blocked })],
    });

    expect(idsOf(pageOf(await readFriendsPage(reader, { viewerId: VIEWER })))).toEqual(["friend"]);
    expect(pageOf(await readSubscriptionsPage(reader, { viewerId: VIEWER })).items).toEqual([]);
    expect(pageOf(await readSubscribersPage(reader, { viewerId: VIEWER })).items).toEqual([]);
    expect(pageOf(await readIncomingInvitesPage(reader, { viewerId: VIEWER })).items).toEqual([]);
    expect(pageOf(await readOutgoingInvitesPage(reader, { viewerId: VIEWER })).items).toEqual([]);
    expect(await readIncomingInvitesCount(reader, VIEWER)).toBe(0);
  });

  it("does not count a blocked inviter in the total of a page", async () => {
    const { reader } = createReader({
      incoming: [member({ id: "blocked", blocked: true }), member({ id: "visible" })],
    });

    const page = pageOf(await readIncomingInvitesPage(reader, { viewerId: VIEWER }));
    expect(page.total).toBe(1);
    expect(idsOf(page)).toEqual(["visible"]);
  });
});
