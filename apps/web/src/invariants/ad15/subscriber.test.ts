// AD-15 (10): a subscriber reads PUBLIC wishes only. The domain policy already
// checks this (`domain/visibility.test.ts`, `domain/subscription.test.ts`), but
// the use-case `readWishlist` — the one gate of both adapters — was not covered.
// Dates (`UserDate`, AD-23) live in `personal-dates.test.ts` of this suite.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { findUnique, findMany } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/db/client", () => ({ prisma: { list: { findUnique }, gift: { findMany } } }));

import { readWishlist } from "@/actions/wishlist-read";

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
  closedAt: Date | null;
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
    closedAt: null,
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

/** u1 owns `l1`: PUBLIC, FRIENDS, SECRET and one archived PUBLIC wish. */
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

const subscriber = vi.fn(async function relationsBetween() {
  return {
    blocked: false,
    friend: false,
    subscriber: true,
    contactMatch: false,
  };
});

beforeEach(() => {
  findUnique.mockReset();
  findMany.mockReset();
  subscriber.mockClear();

  findUnique.mockResolvedValue({
    id: "l1",
    ownerId: "u1",
    publicToken: "tok-1",
    owner: { name: "Анна", nick: "anna" },
  });
  findMany.mockImplementation(async function readGifts(args: { where: GiftWhere }) {
    return query(args.where);
  });
});

describe("AD-15 (10) — подписчик получает только PUBLIC", () => {
  it("показывает PUBLIC и скрывает FRIENDS, SECRET и архив", async () => {
    const result = await readWishlist(
      { viewer: { id: "u9" }, target: { ownerId: "u1" } },
      { reader: { relationsBetween: subscriber } },
    );

    if (result === null) throw new Error("unexpected closed gate");
    expect(subscriber).toHaveBeenCalledWith("u9", "u1");
    expect(result.gifts.map((card) => card.id)).toEqual(["g-public"]);
    expect(result.gifts[0]?.title).toBe("Публичное");

    const body = JSON.stringify(result);
    expect(body).not.toContain("Только друзьям");
    expect(body).not.toContain("Секретное");
    expect(body).not.toContain("Архивное");
  });

  it("отвечает закрытым набором ключей access и gifts, без владельца и токена", async () => {
    const result = await readWishlist(
      { viewer: { id: "u9" }, target: { ownerId: "u1" } },
      { reader: { relationsBetween: subscriber } },
    );

    if (result === null) throw new Error("unexpected closed gate");
    expect(Object.keys(result).sort()).toEqual(["access", "gifts"]);
    expect(result).not.toHaveProperty("owner");
    expect(result).not.toHaveProperty("publicToken");
    expect(result).not.toHaveProperty("archived");
    expect(result).not.toHaveProperty("archivedTotal");
    expect(JSON.stringify(result)).not.toMatch(/count|hidden|filtered|total/);
  });

  it("сужает запрос желаний до PUBLIC и активных, не полагаясь на один фильтр политики", async () => {
    await readWishlist(
      { viewer: { id: "u9" }, target: { ownerId: "u1" } },
      { reader: { relationsBetween: subscriber } },
    );

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany.mock.calls[0]?.[0].where).toMatchObject({
      listId: "l1",
      archivedAt: null,
      visibility: { in: ["PUBLIC"] },
    });
  });
});
