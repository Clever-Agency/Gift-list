import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, findMany, readProfileRelation } = vi.hoisted(() => ({
  getSession: vi.fn(),
  findMany: vi.fn(),
  readProfileRelation: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({ prisma: { user: { findMany } } }));
vi.mock("@/lib/relationships", () => ({ readProfileRelation }));

import {
  USER_SEARCH_LIMIT,
  normalizeForSearch,
  type ProfileRelationship,
} from "@gift-list/contracts";

import { searchUsers } from "./search-users";

const headers = new Headers();

function card(name: string, nick: string, relationship: ProfileRelationship = "NONE") {
  return { displayName: name, nick, relationship };
}

type Person = {
  id: string;
  name: string;
  nick: string;
  nameNormalized: string;
  nickNormalized: string;
  hideFromSearch: boolean;
};

type FindManyArgs = {
  where: {
    hideFromSearch: boolean;
    nickNormalized?: { startsWith: string };
    nameNormalized?: { contains: string };
    blocksMade?: { none: { blockedId: string } };
    blocksReceived?: { none: { blockerId: string } };
  };
  take: number;
};

type BlockRow = { blockerId: string; blockedId: string };

let people: Person[] = [];
let blocks: BlockRow[] = [];

function person(id: string, name: string, nick: string, hidden = false): Person {
  return {
    id,
    name,
    nick,
    nameNormalized: normalizeForSearch(name),
    nickNormalized: normalizeForSearch(nick),
    hideFromSearch: hidden,
  };
}

beforeEach(() => {
  people = [];
  blocks = [];
  getSession.mockReset();
  findMany.mockReset();
  readProfileRelation.mockReset();
  getSession.mockResolvedValue({ user: { id: "viewer" }, session: { token: "t" } });
  readProfileRelation.mockResolvedValue({ relationship: "NONE" });
  findMany.mockImplementation(function findPeople(args: FindManyArgs) {
    const nickQuery = args.where.nickNormalized?.startsWith;
    const nameQuery = args.where.nameNormalized?.contains;
    const viewerId = args.where.blocksReceived?.none.blockerId;
    return people.filter(function visibleMatch(row) {
      if (args.where.hideFromSearch !== false || row.hideFromSearch) return false;
      // Mirrors the pair of NOT EXISTS subqueries the action sends: a Block in
      // either direction drops the row before it ever reaches a card.
      if (viewerId !== undefined && blockedEitherWay(viewerId, row.id)) return false;
      return nickQuery === undefined
        ? row.nameNormalized.includes(nameQuery ?? "")
        : row.nickNormalized.startsWith(nickQuery);
    });
  });
});

function blockedEitherWay(viewerId: string, candidateId: string): boolean {
  return blocks.some(
    (block) =>
      (block.blockerId === viewerId && block.blockedId === candidateId) ||
      (block.blockerId === candidateId && block.blockedId === viewerId),
  );
}

describe("searchUsers", () => {
  it("requires a session before any query", async () => {
    getSession.mockResolvedValue(null);

    expect(await searchUsers({ q: "анна" }, headers)).toMatchObject({
      ok: false,
      code: "UNAUTHENTICATED",
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("answers an empty successful list for an empty or blank query", async () => {
    expect(await searchUsers({ q: "   " }, headers)).toEqual({ ok: true, data: { users: [] } });
    expect(await searchUsers({ q: "" }, headers)).toEqual({ ok: true, data: { users: [] } });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("answers an empty successful list when nothing matches", async () => {
    people = [person("u1", "Анна", "anna")];

    expect(await searchUsers({ q: "никого" }, headers)).toEqual({
      ok: true,
      data: { users: [] },
    });
  });

  it("finds a nick exactly and ignores its case", async () => {
    people = [person("u1", "Анна", "anna"), person("u2", "Борис", "boris")];

    const result = await searchUsers({ q: "ANNA" }, headers);

    expect(result).toEqual({ ok: true, data: { users: [card("Анна", "anna")] } });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          hideFromSearch: false,
          nickNormalized: { startsWith: "anna" },
        }),
        take: USER_SEARCH_LIMIT,
      }),
    );
    expect(readProfileRelation).toHaveBeenCalledWith("viewer", "u1");
  });

  it("finds a nick by prefix and does not match a prefix in the middle", async () => {
    people = [
      person("u1", "Анна", "anna"),
      person("u2", "Аннушка", "annushka"),
      person("u3", "Банана", "banana"),
    ];

    const result = await searchUsers({ q: "ann" }, headers);

    expect(result.ok && result.data.users.map(function nick(card) { return card.nick; })).toEqual([
      "anna",
      "annushka",
    ]);
  });

  it("finds «Алёна» by «Алена» through normalizeForSearch (NFC, ё → е)", async () => {
    people = [person("u1", "Алёна", "alena")];

    expect(await searchUsers({ q: "Алена" }, headers)).toEqual({
      ok: true,
      data: { users: [card("Алёна", "alena")] },
    });
    expect(await searchUsers({ q: "Алёна".normalize("NFD") }, headers)).toEqual({
      ok: true,
      data: { users: [card("Алёна", "alena")] },
    });
  });

  it("keeps «й» and «и» apart", async () => {
    people = [person("u1", "Йога", "yoga"), person("u2", "Иога", "ioga")];

    const byY = await searchUsers({ q: "йога" }, headers);
    const byI = await searchUsers({ q: "иога" }, headers);

    expect(byY.ok && byY.data.users.map(function nick(card) { return card.nick; })).toEqual([
      "yoga",
    ]);
    expect(byI.ok && byI.data.users.map(function nick(card) { return card.nick; })).toEqual([
      "ioga",
    ]);
  });

  it("finds a display name by a substring, not only by exact or prefix", async () => {
    people = [person("u1", "Алёна", "alena")];

    expect(await searchUsers({ q: "лена" }, headers)).toEqual({
      ok: true,
      data: { users: [card("Алёна", "alena")] },
    });
  });

  it("merges both buckets without duplicates", async () => {
    people = [person("u1", "Anna", "anna")];

    const result = await searchUsers({ q: "anna" }, headers);

    expect(result).toEqual({
      ok: true,
      data: { users: [card("Anna", "anna")] },
    });
    expect(findMany).toHaveBeenCalledTimes(2);
  });

  it("never returns a person with hideFromSearch", async () => {
    people = [person("u1", "Марина", "marina", true)];

    expect(await searchUsers({ q: "марина" }, headers)).toEqual({
      ok: true,
      data: { users: [] },
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ hideFromSearch: false }) }),
    );
  });

  it("hides a person the viewer has blocked, even with hideFromSearch off (AD-7)", async () => {
    people = [person("u1", "Анна", "anna")];
    blocks = [{ blockerId: "viewer", blockedId: "u1" }];

    expect(await searchUsers({ q: "anna" }, headers)).toEqual({
      ok: true,
      data: { users: [] },
    });
    expect(readProfileRelation).not.toHaveBeenCalled();
  });

  it("hides a person who has blocked the viewer, in both buckets", async () => {
    // Matches by nick and by display name, so both queries must drop the row.
    people = [person("u1", "Анна", "anna")];
    blocks = [{ blockerId: "u1", blockedId: "viewer" }];

    expect(await searchUsers({ q: "anna" }, headers)).toEqual({
      ok: true,
      data: { users: [] },
    });
    expect(await searchUsers({ q: "анна" }, headers)).toEqual({
      ok: true,
      data: { users: [] },
    });
    expect(readProfileRelation).not.toHaveBeenCalled();
  });

  it("sends the Block guard as relation filters in the same query, not per card", async () => {
    people = [person("u1", "Анна", "anna"), person("u2", "Борис", "anna_boris")];
    blocks = [{ blockerId: "viewer", blockedId: "u2" }];

    const result = await searchUsers({ q: "anna" }, headers);

    expect(result.ok && result.data.users.map(function nick(user) { return user.nick; })).toEqual([
      "anna",
    ]);
    expect(findMany).toHaveBeenCalledTimes(2);
    for (const [args] of findMany.mock.calls as [FindManyArgs][]) {
      expect(args.where).toMatchObject({
        blocksMade: { none: { blockedId: "viewer" } },
        blocksReceived: { none: { blockerId: "viewer" } },
      });
    }
    expect(readProfileRelation).toHaveBeenCalledTimes(1);
  });

  it("keeps a person who blocked someone else", async () => {
    people = [person("u1", "Анна", "anna")];
    blocks = [{ blockerId: "u1", blockedId: "u9" }];

    expect(await searchUsers({ q: "anna" }, headers)).toEqual({
      ok: true,
      data: { users: [card("Анна", "anna")] },
    });
  });

  it("caps the answer at USER_SEARCH_LIMIT", async () => {
    people = Array.from({ length: USER_SEARCH_LIMIT + 5 }, function makePerson(_, index) {
      const number = String(index + 1).padStart(2, "0");
      return person(`u${number}`, `Анна ${number}`, `anna${number}`);
    });

    const result = await searchUsers({ q: "анна" }, headers);

    expect(result.ok && result.data.users).toHaveLength(USER_SEARCH_LIMIT);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: USER_SEARCH_LIMIT }),
    );
  });

  it("ranks an exact nick, then a nick prefix, then a display-name match", async () => {
    people = [
      person("u1", "Яна", "anna"), // exact nick
      person("u2", "Boris", "anna_2"), // nick prefix
      person("u3", "Anna", "kate"), // display name only
    ];

    const result = await searchUsers({ q: "anna" }, headers);

    expect(result.ok && result.data.users.map(function nick(card) { return card.nick; })).toEqual([
      "anna",
      "anna_2",
      "kate",
    ]);
  });

  it("sorts display-name matches by name through compareForSort", async () => {
    // Both cards are name-only matches; their nicks sort the other way, so the
    // test pins the order inside the last bucket, not a whole-answer sort.
    people = [person("u1", "Марат", "zzz"), person("u2", "Анна", "aaa")];

    const result = await searchUsers({ q: "а" }, headers);

    expect(result.ok && result.data.users.map(function name(card) { return card.displayName; })).toEqual(
      ["Анна", "Марат"],
    );
  });

  it("adds the viewer relation to every card, never wishlist fields (NFR-3)", async () => {
    people = [person("u1", "Анна", "anna")];

    const result = await searchUsers({ q: "анна" }, headers);
    const personCard = result.ok ? result.data.users[0] : undefined;

    expect(personCard && Object.keys(personCard).sort()).toEqual([
      "displayName",
      "nick",
      "relationship",
    ]);
    expect(personCard).toMatchObject({ relationship: "NONE" });
    expect(personCard).not.toHaveProperty("gifts");
    expect(personCard).not.toHaveProperty("hideFromSearch");
    expect(personCard).not.toHaveProperty("email");
  });

  it("fills NONE, OUTGOING_PENDING, INCOMING_PENDING and FRIENDS in one answer", async () => {
    people = [
      person("u1", "Анна", "anna"),
      person("u2", "Борис", "anna_boris"),
      person("u3", "Вера", "anna_vera"),
      person("u4", "Глеб", "anna_gleb"),
    ];
    const relations: Record<string, ProfileRelationship> = {
      u1: "NONE",
      u2: "OUTGOING_PENDING",
      u3: "INCOMING_PENDING",
      u4: "FRIENDS",
    };
    readProfileRelation.mockImplementation(function relationFor(_viewer: string, ownerId: string) {
      return Promise.resolve({ relationship: relations[ownerId] });
    });

    const result = await searchUsers({ q: "anna" }, headers);

    expect(result.ok && result.data.users).toEqual([
      card("Анна", "anna", "NONE"),
      card("Борис", "anna_boris", "OUTGOING_PENDING"),
      card("Вера", "anna_vera", "INCOMING_PENDING"),
      card("Глеб", "anna_gleb", "FRIENDS"),
    ]);
    expect(readProfileRelation).toHaveBeenCalledTimes(4);
  });

  it("carries a live cooldown in the profile shape next to relationship NONE", async () => {
    people = [person("u1", "Анна", "anna")];
    readProfileRelation.mockResolvedValue({
      relationship: "NONE",
      inviteCooldown: { hours: 5, rejected: true },
    });

    const result = await searchUsers({ q: "анна" }, headers);

    expect(result).toEqual({
      ok: true,
      data: {
        users: [
          {
            displayName: "Анна",
            nick: "anna",
            relationship: "NONE",
            inviteCooldown: { hours: 5, rejected: true },
          },
        ],
      },
    });
  });

  it("reads the relation for the viewer's own row through the same reader", async () => {
    people = [person("viewer", "Я", "me")];

    await searchUsers({ q: "me" }, headers);

    expect(readProfileRelation).toHaveBeenCalledWith("viewer", "viewer");
  });

  it("never asks for a relation when nothing matches", async () => {
    people = [person("u1", "Анна", "anna")];

    await searchUsers({ q: "никого" }, headers);

    expect(readProfileRelation).not.toHaveBeenCalled();
  });
});
