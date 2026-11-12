import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, findMany } = vi.hoisted(() => ({
  getSession: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({ prisma: { user: { findMany } } }));

import { USER_SEARCH_LIMIT, normalizeForSearch } from "@gift-list/contracts";

import { searchUsers } from "./search-users";

const headers = new Headers();

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
  };
  take: number;
};

let people: Person[] = [];

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
  getSession.mockReset();
  findMany.mockReset();
  getSession.mockResolvedValue({ user: { id: "viewer" }, session: { token: "t" } });
  findMany.mockImplementation(function findPeople(args: FindManyArgs) {
    const nickQuery = args.where.nickNormalized?.startsWith;
    const nameQuery = args.where.nameNormalized?.contains;
    return people.filter(function visibleMatch(row) {
      if (args.where.hideFromSearch !== false || row.hideFromSearch) return false;
      return nickQuery === undefined
        ? row.nameNormalized.includes(nameQuery ?? "")
        : row.nickNormalized.startsWith(nickQuery);
    });
  });
});

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

    expect(result).toEqual({ ok: true, data: { users: [{ displayName: "Анна", nick: "anna" }] } });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { hideFromSearch: false, nickNormalized: { startsWith: "anna" } },
        take: USER_SEARCH_LIMIT,
      }),
    );
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
      data: { users: [{ displayName: "Алёна", nick: "alena" }] },
    });
    expect(await searchUsers({ q: "Алёна".normalize("NFD") }, headers)).toEqual({
      ok: true,
      data: { users: [{ displayName: "Алёна", nick: "alena" }] },
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
      data: { users: [{ displayName: "Алёна", nick: "alena" }] },
    });
  });

  it("merges both buckets without duplicates", async () => {
    people = [person("u1", "Anna", "anna")];

    const result = await searchUsers({ q: "anna" }, headers);

    expect(result).toEqual({
      ok: true,
      data: { users: [{ displayName: "Anna", nick: "anna" }] },
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

  it("sorts cards by display name through compareForSort", async () => {
    people = [person("u1", "Марат", "marat"), person("u2", "Анна", "anna")];

    const result = await searchUsers({ q: "а" }, headers);

    expect(result.ok && result.data.users.map(function name(card) { return card.displayName; })).toEqual(
      ["Анна", "Марат"],
    );
  });

  it("returns only displayName and nick (NFR-3)", async () => {
    people = [person("u1", "Анна", "anna")];

    const result = await searchUsers({ q: "анна" }, headers);
    const card = result.ok ? result.data.users[0] : undefined;

    expect(card && Object.keys(card).sort()).toEqual(["displayName", "nick"]);
    expect(card).not.toHaveProperty("gifts");
    expect(card).not.toHaveProperty("hideFromSearch");
  });
});
