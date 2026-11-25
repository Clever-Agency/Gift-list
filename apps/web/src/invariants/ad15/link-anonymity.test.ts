// AD-15 (2): an anonymous visitor of `/l/:token` sees only PUBLIC wishes and
// never learns a hidden title, the share token or a hidden count. The page and
// the `api/v1` action are checked together, because AD-7 promises one gate and
// the two adapters must not drift apart.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, headers, findUnique, findMany, relationsBetween } = vi.hoisted(() => ({
  getSession: vi.fn(),
  headers: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  relationsBetween: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({ prisma: { list: { findUnique }, gift: { findMany } } }));
vi.mock("@/lib/relationships", () => ({ relationshipReader: { relationsBetween } }));

import { getWishlistByToken } from "@/actions/public-wishlist";
import { loadLinkPage } from "@/app/l/[token]/link-page";

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

/** One PUBLIC wish, one FRIENDS, one SECRET and one archived PUBLIC one. */
const rows: Row[] = [
  gift({ id: "g-public", title: "Публичное" }),
  gift({ id: "g-friends", title: "Только друзьям", visibility: "FRIENDS" }),
  gift({ id: "g-secret", title: "Секретное", visibility: "SECRET" }),
  gift({
    id: "g-archived",
    title: "Архивное",
    archivedAt: new Date("2026-01-01T00:00:00.000Z"),
  }),
];

type GiftWhere = {
  listId: string;
  archivedAt?: null;
  NOT?: { archivedAt: null };
  visibility?: { in: readonly Row["visibility"][] };
};

/** Applies the read's own narrowing, so a widened query shows up as a leaked title. */
function query(where: GiftWhere): Row[] {
  if (where.listId !== "l1") return [];
  const archived = where.NOT?.archivedAt === null;
  return rows.filter(function visible(row) {
    if ((row.archivedAt !== null) !== archived) return false;
    return where.visibility === undefined || where.visibility.in.includes(row.visibility);
  });
}

beforeEach(() => {
  getSession.mockReset();
  headers.mockReset();
  findUnique.mockReset();
  findMany.mockReset();
  relationsBetween.mockReset();

  headers.mockResolvedValue(new Headers({ "accept-language": "ru-RU,ru;q=0.9" }));
  getSession.mockResolvedValue(null);
  findUnique.mockResolvedValue({
    id: "l1",
    ownerId: "u1",
    publicToken: "tok-1",
    owner: { name: "Анна", nick: "anna" },
  });
  findMany.mockImplementation(async function readGifts(args: { where: GiftWhere }) {
    return query(args.where);
  });
  relationsBetween.mockResolvedValue({
    blocked: false,
    friend: false,
    subscriber: false,
    contactMatch: false,
  });
});

describe("AD-15 (2) — аноним по /l/:token видит только PUBLIC", () => {
  it("даёт странице и api/v1 один и тот же PUBLIC-набор и одного владельца", async () => {
    const page = await loadLinkPage("tok-1");
    const api = await getWishlistByToken(
      "tok-1",
      new Headers({ "accept-language": "ru-RU,ru;q=0.9" }),
    );

    expect(page.view.kind).toBe("gifts");
    if (page.view.kind !== "gifts") throw new Error("expected a gifts view");
    expect(api.ok).toBe(true);
    if (!api.ok) throw new Error("expected an open answer");

    const pageCards = page.view.gifts.map((card) => ({ id: card.id, title: card.title }));
    const apiCards = api.data.gifts.map((card) => ({ id: card.id, title: card.title }));
    expect(apiCards).toEqual(pageCards);
    expect(apiCards).toEqual([{ id: "g-public", title: "Публичное" }]);
    expect(api.data.owner).toEqual(page.view.owner);
    expect(page.view.owner).toEqual({ displayName: "Анна", nick: "anna" });
  });

  it("не отдаёт ни одному адаптеру скрытые названия, токен, архив и счётчики", async () => {
    const page = await loadLinkPage("tok-1");
    const api = await getWishlistByToken(
      "tok-1",
      new Headers({ "accept-language": "ru-RU,ru;q=0.9" }),
    );

    expect(page.view.kind).toBe("gifts");
    if (api.ok === false) throw new Error("expected an open answer");

    for (const body of [JSON.stringify(page.view), JSON.stringify(api.data)]) {
      expect(body).not.toContain("Только друзьям");
      expect(body).not.toContain("Секретное");
      expect(body).not.toContain("Архивное");
      // A viewer card may carry `archivedAt: null` (the contract field), but no
      // answer may carry the share token, the owner's archive or a counter.
      expect(body).not.toMatch(/"(publicToken|archived|archivedTotal|count|hidden|filtered|total)":/);
    }

    const answer = api.data;
    expect(Object.keys(answer).sort()).toEqual(["access", "gifts", "owner"]);
    expect(Object.keys(page.view).sort()).toEqual(["gifts", "kind", "owner"]);
    expect(answer).not.toHaveProperty("publicToken");
    expect(answer).not.toHaveProperty("archived");
    expect(answer).not.toHaveProperty("archivedTotal");
  });

  it("проводит оба чтения через один узкий запрос: только PUBLIC и без архива", async () => {
    await loadLinkPage("tok-1");
    await getWishlistByToken("tok-1", new Headers({ "accept-language": "ru-RU,ru;q=0.9" }));

    expect(findUnique).toHaveBeenCalledTimes(2);
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { publicToken: "tok-1" } }),
    );

    const wheres = findMany.mock.calls.map(([args]) => (args as { where: GiftWhere }).where);
    expect(wheres).toHaveLength(2);
    for (const where of wheres) {
      expect(where.visibility).toEqual({ in: ["PUBLIC"] });
      expect(where.archivedAt).toBeNull();
    }
  });
});
