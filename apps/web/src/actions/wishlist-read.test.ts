import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { findUnique, findMany } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/db/client", () => ({ prisma: { list: { findUnique }, gift: { findMany } } }));

import type { ListData } from "@gift-list/contracts";
import type { ViewerRelations } from "@/domain/visibility";

import { readWishlist, type ReadWishlistDeps } from "./wishlist-read";

type Row = {
  id: string;
  title: string;
  description: string | null;
  priceAmount: number | null;
  priceCurrency: "USD" | "EUR" | "CNY" | "BYN" | "RUB" | null;
  linkUrl: string | null;
  visibility: "PUBLIC" | "FRIENDS" | "SECRET";
  quantity: "SINGLE" | "UNLIMITED";
  expiresOn: Date | null;
  archivedAt: Date | null;
  status: "OPEN" | "RESERVED" | "CLOSED";
  reservationPhase: "ACTIVE" | "AWAITING_GIVER" | "AWAITING_OWNER" | "GIVEN" | null;
  reservationBought: boolean;
  holderVisibleToOwner: boolean;
  holderVisibleToOthers: boolean;
  reservedBy: { id: string; nick: string; name: string } | null;
  tags: { tagId: string | null; customText: string | null; tag: { slug: string; labels: unknown } | null }[];
};

function gift(overrides: Partial<Row> & Pick<Row, "id" | "title">): Row {
  return {
    description: null,
    priceAmount: null,
    priceCurrency: null,
    linkUrl: null,
    visibility: "PUBLIC",
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
    ...overrides,
  };
}

/** u1 owns `l1`; the rows are ordered newest first, like the query orders them. */
const rows: Row[] = [
  gift({ id: "g-public", title: "Публичное", visibility: "PUBLIC" }),
  gift({ id: "g-friends", title: "Для друзей", visibility: "FRIENDS" }),
  gift({ id: "g-secret", title: "Секрет", visibility: "SECRET" }),
  gift({
    id: "g-reserved",
    title: "Забронированное",
    status: "RESERVED",
    reservationPhase: "ACTIVE",
    holderVisibleToOthers: false,
    reservedBy: { id: "u2", nick: "anna", name: "Анна" },
  }),
  gift({
    id: "g-archived",
    title: "Архивное",
    archivedAt: new Date("2026-01-01T00:00:00.000Z"),
  }),
];

type GiftWhere = {
  listId: string;
  archivedAt: null;
  visibility?: { in: readonly Row["visibility"][] };
};

/**
 * Honest stand-in for the database: it applies `listId`, `archivedAt` and
 * `visibility.in` to the fixture, so a widened read shows up as a leaked title.
 */
function query(where: GiftWhere): Row[] {
  if (where.listId !== "l1") return [];
  return rows.filter((row) => {
    if (where.archivedAt === null && row.archivedAt !== null) return false;
    return where.visibility === undefined || where.visibility.in.includes(row.visibility);
  });
}

function reader(relations: Partial<Omit<ViewerRelations, "viaListToken">> = {}) {
  const relationsBetween = vi.fn(async () => ({
    blocked: false,
    friend: false,
    subscriber: false,
    contactMatch: false,
    ...relations,
  }));
  const deps: ReadWishlistDeps = { reader: { relationsBetween } };
  return { relationsBetween, deps };
}

function giftsOf(result: ListData) {
  if (result.access !== "gifts") throw new Error(`unexpected access: ${result.access}`);
  return result.gifts;
}

beforeEach(() => {
  findUnique.mockReset();
  findMany.mockReset();
  findUnique.mockResolvedValue({
    id: "l1",
    ownerId: "u1",
    publicToken: "tok-1",
    owner: { name: "Анна", nick: "anna" },
  });
  findMany.mockImplementation(({ where }: { where: GiftWhere }) => Promise.resolve(query(where)));
});

describe("readWishlist", () => {
  it("gives the owner every active gift of the list, SECRET included", async () => {
    const result = await readWishlist(
      { viewer: { id: "u1" }, target: { ownerId: "u1" } },
      reader().deps,
    );

    expect(giftsOf(result).map((card) => card.id)).toEqual([
      "g-public",
      "g-friends",
      "g-secret",
      "g-reserved",
    ]);
    expect(giftsOf(result).find((card) => card.id === "g-secret")?.visibility).toBe("SECRET");
    expect(giftsOf(result).some((card) => card.id === "g-archived")).toBe(false);
  });

  /** Story 2.4 (AD-6, A-26): the owner builds the share link from this token. */
  it("gives the owner the list's immutable publicToken", async () => {
    const result = await readWishlist(
      { viewer: { id: "u1" }, target: { ownerId: "u1" } },
      reader().deps,
    );

    expect(result).toMatchObject({ access: "gifts", publicToken: "tok-1" });
    expect(findUnique).toHaveBeenCalledWith({
      where: { ownerId: "u1" },
      select: {
        id: true,
        ownerId: true,
        publicToken: true,
        owner: { select: { name: true, nick: true } },
      },
    });
  });

  it("keeps the owner's publicToken with an empty wishlist", async () => {
    findMany.mockResolvedValue([]);

    const result = await readWishlist(
      { viewer: { id: "u1" }, target: { ownerId: "u1" } },
      reader().deps,
    );

    expect(result).toEqual({ access: "gifts", gifts: [], publicToken: "tok-1" });
  });

  /** The share token is the owner's: a friend or link visitor must not receive it. */
  it("never hands publicToken to a non-owner viewer", async () => {
    const friend = await readWishlist(
      { viewer: { id: "u9" }, target: { ownerId: "u1" } },
      reader({ friend: true }).deps,
    );
    const anonymous = await readWishlist(
      { viewer: null, target: { publicToken: "tok" }, viaListToken: true },
      reader().deps,
    );
    const signedInLinkVisitor = await readWishlist(
      { viewer: { id: "u9" }, target: { publicToken: "tok-1" }, viaListToken: true },
      reader().deps,
    );

    for (const answer of [friend, anonymous, signedInLinkVisitor]) {
      expect(JSON.stringify(answer)).not.toContain("tok-1");
    }
    // A link read names the owner (Story 3.3); an ownerId read has no use for it.
    expect(Object.keys(friend).sort()).toEqual(["access", "gifts"]);
    for (const answer of [anonymous, signedInLinkVisitor]) {
      expect(Object.keys(answer).sort()).toEqual(["access", "gifts", "owner"]);
    }
  });

  it("never asks for relation facts when the owner reads their own list", async () => {
    const { relationsBetween, deps } = reader();

    await readWishlist({ viewer: { id: "u1" }, target: { ownerId: "u1" } }, deps);

    expect(relationsBetween).not.toHaveBeenCalled();
  });

  /** NFR-3: a stranger learns neither the number nor the titles of hidden gifts. */
  it("shows a signed-in stranger nothing and leaks no filtered title", async () => {
    const { relationsBetween, deps } = reader();

    const result = await readWishlist({ viewer: { id: "u9" }, target: { ownerId: "u1" } }, deps);

    expect(relationsBetween).toHaveBeenCalledWith("u9", "u1");
    expect(result).toEqual({ access: "gifts", gifts: [] });
    expect(Object.keys(result).sort()).toEqual(["access", "gifts"]);

    const body = JSON.stringify(result);
    expect(body).not.toContain("Для друзей");
    expect(body).not.toContain("Секрет");
    expect(body).not.toContain("Публичное");
    expect(body).not.toMatch(/count|hidden|filtered/);
  });

  it("shows an anonymous link visitor only PUBLIC gifts and hides the holder", async () => {
    const result = await readWishlist(
      { viewer: null, target: { publicToken: "tok" }, viaListToken: true },
      reader().deps,
    );

    expect(giftsOf(result).map((card) => card.id)).toEqual(["g-public", "g-reserved"]);
    expect(giftsOf(result).find((card) => card.id === "g-reserved")?.reservedBy).toBeNull();
  });

  /** Story 3.3: the page heading comes from the answer, even for an empty list. */
  it("names the owner on a link read, including an empty list", async () => {
    const anonymous = await readWishlist(
      { viewer: null, target: { publicToken: "tok-1" }, viaListToken: true },
      reader().deps,
    );
    findMany.mockResolvedValue([]);
    const empty = await readWishlist(
      { viewer: null, target: { publicToken: "tok-1" }, viaListToken: true },
      reader().deps,
    );

    for (const answer of [anonymous, empty]) {
      expect(answer).toMatchObject({
        access: "gifts",
        owner: { displayName: "Анна", nick: "anna" },
      });
      expect(Object.keys(answer)).not.toContain("publicToken");
    }
    expect(giftsOf(empty)).toEqual([]);
  });

  /**
   * Story 3.3: the token fact is what opens `PUBLIC` to a stranger. A caller who
   * forgets `viaListToken` must not widen the read just because the token was
   * found.
   */
  it("opens nothing without the viaListToken fact", async () => {
    const result = await readWishlist(
      { viewer: { id: "u9" }, target: { publicToken: "tok-1" } },
      reader().deps,
    );

    expect(giftsOf(result)).toEqual([]);
    // Even an empty link answer still names the owner for the page heading.
    expect(result).toMatchObject({ owner: { displayName: "Анна", nick: "anna" } });
    expect(findMany).not.toHaveBeenCalled();
  });

  /** Story 3.3: the flag cannot open a read that never arrived through the link. */
  it("ignores viaListToken on an ownerId read", async () => {
    const result = await readWishlist(
      { viewer: { id: "u9" }, target: { ownerId: "u1" }, viaListToken: true },
      reader().deps,
    );

    expect(giftsOf(result)).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("shows a friend PUBLIC and FRIENDS gifts, never SECRET or archived", async () => {
    const { relationsBetween, deps } = reader({ friend: true });

    const result = await readWishlist({ viewer: { id: "u9" }, target: { ownerId: "u1" } }, deps);

    expect(relationsBetween).toHaveBeenCalledWith("u9", "u1");
    expect(giftsOf(result).map((card) => card.id)).toEqual([
      "g-public",
      "g-friends",
      "g-reserved",
    ]);
  });

  it("hides a blocked list behind not_found without reading gifts", async () => {
    const { deps } = reader({ blocked: true });

    const result = await readWishlist(
      { viewer: { id: "u9" }, target: { publicToken: "tok" }, viaListToken: true },
      deps,
    );

    expect(result).toEqual({ access: "not_found", gifts: [] });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("answers not_found for an unknown token without reading gifts", async () => {
    findUnique.mockResolvedValue(null);

    const result = await readWishlist(
      { viewer: null, target: { publicToken: "nope" }, viaListToken: true },
      reader().deps,
    );

    expect(result).toEqual({ access: "not_found", gifts: [] });
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe("readWishlist tags", () => {
  const dream = { tagId: "tag_dream", customText: null, tag: { slug: "dream", labels: { ru: "мечта" } } };
  const custom = { tagId: null, customText: "своё", tag: null };
  const secretTag = {
    tagId: "tag_secret",
    customText: null,
    tag: { slug: "secret", labels: { ru: "секретный тег" } },
  };

  /** Story 2.5/AD-22/AD-27: tags ride on the visible card only, labelled by the server. */
  it("maps tags of visible gifts and never returns a hidden gift's tags", async () => {
    findMany.mockResolvedValue([
      gift({ id: "g-public", title: "Публичное", tags: [dream, custom] }),
      gift({ id: "g-secret", title: "Секрет", visibility: "SECRET", tags: [secretTag] }),
    ]);

    const result = await readWishlist(
      { viewer: { id: "u9" }, target: { ownerId: "u1" }, locale: "ru" },
      reader({ friend: true }).deps,
    );

    const cards = giftsOf(result);
    expect(cards.map((card) => card.id)).toEqual(["g-public"]);
    expect(cards[0]?.tags).toEqual([
      { catalogId: null, label: "своё" },
      { catalogId: "tag_dream", label: "мечта" },
    ]);
    expect(JSON.stringify(result)).not.toContain("секретный тег");
  });

  it("gives the owner tags of a SECRET gift too", async () => {
    findMany.mockResolvedValue([
      gift({ id: "g-secret", title: "Секрет", visibility: "SECRET", tags: [secretTag] }),
    ]);

    const result = await readWishlist(
      { viewer: { id: "u1" }, target: { ownerId: "u1" } },
      reader().deps,
    );

    expect(giftsOf(result)[0]?.tags).toEqual([
      { catalogId: "tag_secret", label: "секретный тег" },
    ]);
  });

  it("localizes a fixed tag by the request locale with a DEFAULT_LOCALE fallback", async () => {
    findMany.mockResolvedValue([gift({ id: "g-public", title: "Публичное", tags: [dream] })]);

    const result = await readWishlist(
      { viewer: { id: "u1" }, target: { ownerId: "u1" } },
      reader().deps,
    );

    expect(giftsOf(result)[0]?.tags).toEqual([{ catalogId: "tag_dream", label: "мечта" }]);
  });
});
