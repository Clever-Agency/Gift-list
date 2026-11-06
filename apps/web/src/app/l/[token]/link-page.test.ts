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

import { wishlistPathForToken } from "@/lib/public-token";
import { buildLinkMetadata, loadLinkPage } from "./link-page";

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

const rows: Row[] = [
  gift({ id: "g-public", title: "Публичное" }),
  gift({ id: "g-friends", title: "Только друзьям", visibility: "FRIENDS" }),
  gift({ id: "g-secret", title: "Секретное", visibility: "SECRET" }),
];

type GiftWhere = {
  listId: string;
  archivedAt: null;
  visibility?: { in: readonly Row["visibility"][] };
};

function query(where: GiftWhere): Row[] {
  if (where.listId !== "l1") return [];
  return rows.filter(function visible(row) {
    if (where.archivedAt === null && row.archivedAt !== null) return false;
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

describe("wishlistPathForToken", () => {
  it("builds the one allowed relative target from the validated segment", () => {
    expect(wishlistPathForToken("tok-1")).toBe("/wishlist/tok-1");
  });

  it("returns no target for a dot segment, encoded path or absolute URL", () => {
    for (const token of [
      "",
      "..",
      "../admin",
      "a/b",
      "//evil.example",
      "https://evil.example",
      "tok?next=//evil.example",
    ]) {
      expect(wishlistPathForToken(token)).toBeNull();
    }
  });
});

describe("loadLinkPage: session and redirect", () => {
  it("redirects a real session to the one-segment SPA path built from the token", async () => {
    getSession.mockResolvedValue({ user: { id: "u2" } });

    const page = await loadLinkPage("tok-1");

    expect(page.view).toEqual({ kind: "redirect", to: "/wishlist/tok-1" });
    expect(findUnique).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });

  it.each(["..", "%2e%2e", "a/b", "//evil.example", "https://evil.example", "tok?next=//evil.example"])(
    "treats a malformed segment %s as not found even with a session",
    async function malformed(token) {
      getSession.mockResolvedValue({ user: { id: "u2" } });

      const page = await loadLinkPage(token);

      expect(page.view).toEqual({ kind: "not_found" });
      expect(getSession).not.toHaveBeenCalled();
      expect(findUnique).not.toHaveBeenCalled();
    },
  );

  it("does not redirect for an unrecognised cookie: no session, public page", async () => {
    getSession.mockResolvedValue(null);

    const page = await loadLinkPage("tok-1");

    expect(page.view.kind).toBe("gifts");
  });
});

describe("loadLinkPage: anonymous read through the one gate", () => {
  it("renders only PUBLIC wishes and the owner's public name and nick", async () => {
    const page = await loadLinkPage("tok-1");

    expect(page.locale).toBe("ru");
    expect(page.view.kind).toBe("gifts");
    if (page.view.kind !== "gifts") throw new Error("expected a gifts view");

    expect(page.view.owner).toEqual({ displayName: "Анна", nick: "anna" });
    expect(page.view.gifts.map((item) => item.title)).toEqual(["Публичное"]);
    const serialized = JSON.stringify(page.view);
    expect(serialized).not.toContain("Только друзьям");
    expect(serialized).not.toContain("Секретное");
    expect(findMany.mock.calls[0]?.[0].where.visibility).toEqual({ in: ["PUBLIC"] });
  });

  it("answers a missing list and a block with the same closed view", async () => {
    findUnique.mockResolvedValueOnce(null);
    const unknown = await loadLinkPage("tok-1");

    relationsBetween.mockResolvedValueOnce({
      blocked: true,
      friend: false,
      subscriber: false,
      contactMatch: false,
    });
    const blocked = await loadLinkPage("tok-1");

    expect(unknown.view).toEqual({ kind: "not_found" });
    expect(blocked.view).toEqual(unknown.view);
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe("buildLinkMetadata", () => {
  it("names only the owner and the product for a visible list", async () => {
    const page = await loadLinkPage("tok-1");
    const metadata = buildLinkMetadata(page, "Gift List");
    const serialized = JSON.stringify(metadata);

    expect(metadata.title).toBe("Вишлист Анна — Gift List");
    expect(serialized).not.toContain("Публичное");
    expect(serialized).not.toContain("Только друзьям");
    expect(serialized).not.toContain("Секретное");
    expect(serialized).not.toContain("photo");
    expect(serialized).not.toContain("count");
  });

  it("gives unknown, blocked, malformed and missing lists one not-found metadata", async () => {
    const notFound = buildLinkMetadata(
      { locale: "ru", view: { kind: "not_found" } },
      "Gift List",
    );
    const redirect = buildLinkMetadata(
      { locale: "ru", view: { kind: "redirect", to: "/wishlist/tok-1" } },
      "Gift List",
    );

    expect(notFound).toEqual(redirect);
    expect(notFound.title).toBe("Список не найден — Gift List");
    expect(JSON.stringify(notFound)).not.toContain("Анна");
  });
});
