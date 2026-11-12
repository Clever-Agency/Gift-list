import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, findUnique, findMany, relationsBetween } = vi.hoisted(() => ({
  getSession: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  relationsBetween: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({ prisma: { list: { findUnique }, gift: { findMany } } }));
vi.mock("@/lib/relationships", () => ({ relationshipReader: { relationsBetween } }));

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

/** u1 owns `l1`; the hidden titles must never reach an unknown or blocked visitor. */
const rows: Row[] = [
  gift({ id: "g-public", title: "Публичное" }),
  gift({ id: "g-friends", title: "Для друзей", visibility: "FRIENDS" }),
  gift({ id: "g-secret", title: "Секрет", visibility: "SECRET" }),
  gift({ id: "g-archived", title: "Архивное", archivedAt: new Date("2026-01-01T00:00:00.000Z") }),
];

type GiftWhere = {
  listId: string;
  archivedAt: null;
  visibility?: { in: readonly Row["visibility"][] };
};

/** Applies the SQL filters to the fixture, so a widened read leaks a title here. */
function query(where: GiftWhere): Row[] {
  if (where.listId !== "l1") return [];
  return rows.filter((row) => {
    if (where.archivedAt === null && row.archivedAt !== null) return false;
    return where.visibility === undefined || where.visibility.in.includes(row.visibility);
  });
}

/**
 * Calls the handler with the segments Next would pass: `["tok-1"]` for a normal
 * link, `[]` for a bare `/api/v1/l`, more than one for a malformed path.
 */
async function callRoute(segments: string[], headers: Record<string, string> = {}) {
  const { GET } = await import("./route");
  const path = segments.map((segment) => encodeURIComponent(segment)).join("/");
  const res = await GET(new Request(`http://x/api/v1/l/${path}`, { headers }), {
    params: Promise.resolve({ token: segments }),
  });
  return { res, body: await res.json() };
}

beforeEach(() => {
  getSession.mockReset();
  findUnique.mockReset();
  findMany.mockReset();
  relationsBetween.mockReset();

  getSession.mockResolvedValue(null);
  findUnique.mockResolvedValue({
    id: "l1",
    ownerId: "u1",
    publicToken: "tok-1",
    owner: { name: "Анна", nick: "anna" },
  });
  findMany.mockImplementation(({ where }: { where: GiftWhere }) => Promise.resolve(query(where)));
  relationsBetween.mockResolvedValue({
    blocked: false,
    friend: false,
    subscriber: false,
    contactMatch: false,
  });
});

describe("GET /api/v1/l/:token", () => {
  it("gives an anonymous link visitor only PUBLIC gifts and names the owner", async () => {
    const { res, body } = await callRoute(["tok-1"]);

    expect(res.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      data: {
        access: "gifts",
        owner: { displayName: "Анна", nick: "anna" },
        gifts: [expect.objectContaining({ id: "g-public", title: "Публичное" })],
      },
    });
    expect(Object.keys(body.data)).not.toContain("publicToken");
    expect(body.data).not.toHaveProperty("relationship");
    expect(body.data).not.toHaveProperty("inviteCooldown");
    expect(body.data).not.toHaveProperty("subscribed");
    expect(JSON.stringify(body)).not.toContain("Для друзей");
    expect(JSON.stringify(body)).not.toContain("Секрет");
  });

  it("names the owner with an empty list when every wish is FRIENDS, SECRET or archived", async () => {
    findMany.mockResolvedValue([
      gift({ id: "g-friends", title: "Для друзей", visibility: "FRIENDS" }),
      gift({ id: "g-secret", title: "Секрет", visibility: "SECRET" }),
      gift({
        id: "g-archived",
        title: "Архивное",
        archivedAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    ]);

    const { res, body } = await callRoute(["tok-1"]);

    expect(res.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      data: {
        access: "gifts",
        owner: { displayName: "Анна", nick: "anna" },
        gifts: [],
      },
    });
    const text = JSON.stringify(body);
    expect(text).not.toContain("Для друзей");
    expect(text).not.toContain("Секрет");
    expect(text).not.toContain("Архивное");
  });

  it("sets Cache-Control: private, no-store", async () => {
    const { res } = await callRoute(["tok-1"]);

    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("gives a signed-in friend PUBLIC and FRIENDS gifts, never SECRET", async () => {
    getSession.mockResolvedValue({ user: { id: "u9" }, session: {} });
    relationsBetween.mockResolvedValue({
      blocked: false,
      friend: true,
      subscriber: false,
      contactMatch: false,
    });

    const { body } = await callRoute(["tok-1"]);
    const titles = body.data.gifts.map((card: { title: string }) => card.title);

    expect(relationsBetween).toHaveBeenCalledWith("u9", "u1");
    expect(titles).toEqual(["Публичное", "Для друзей"]);
    expect(Object.keys(body.data)).not.toContain("publicToken");
    expect(JSON.stringify(body)).not.toContain("Секрет");
  });

  it("gives the owner their own link: SECRET gifts and the publicToken", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" }, session: {} });

    const { body } = await callRoute(["tok-1"]);
    const titles = body.data.gifts.map((card: { title: string }) => card.title);

    expect(titles).toEqual(["Публичное", "Для друзей", "Секрет"]);
    expect(body.data.publicToken).toBe("tok-1");
    expect(body.data).not.toHaveProperty("relationship");
    expect(body.data).not.toHaveProperty("inviteCooldown");
    expect(body.data).not.toHaveProperty("subscribed");
    expect(body.data.owner).toEqual({ displayName: "Анна", nick: "anna" });
  });

  it("answers a block with the same safe body as an unknown token", async () => {
    relationsBetween.mockResolvedValue({
      blocked: true,
      friend: false,
      subscriber: false,
      contactMatch: false,
    });
    const blocked = await callRoute(["tok-1"]);
    findUnique.mockResolvedValue(null);
    const unknown = await callRoute(["no-such-token"]);

    expect(blocked.res.status).toBe(unknown.res.status);
    expect(blocked.body).toEqual(unknown.body);
    expect(blocked.body).toEqual({ ok: true, data: { access: "not_found", gifts: [] } });
    expect(JSON.stringify(blocked.body)).not.toContain("Анна");
    expect(JSON.stringify(blocked.body)).not.toContain("Секрет");
  });

  it("treats a malformed token like an unknown one without touching the database", async () => {
    findUnique.mockResolvedValue(null);
    const unknown = await callRoute(["no-such-token"]);
    findUnique.mockClear();
    getSession.mockClear();
    const malformed = [
      [],
      [""],
      ["a/b"],
      ["a\\b"],
      ["%2f"],
      ["%5C"],
      ["x".repeat(129)],
      ["a", "b"],
    ];

    for (const segments of malformed) {
      const { res, body } = await callRoute(segments);
      expect(res.status).toBe(unknown.res.status);
      expect(body).toEqual(unknown.body);
      expect(res.headers.get("cache-control")).toBe("private, no-store");
    }
    expect(findUnique).not.toHaveBeenCalled();
    expect(getSession).not.toHaveBeenCalled();
  });

  it("passes the request headers to getSession", async () => {
    await callRoute(["tok-1"], { cookie: "sid=forged", "accept-language": "ru" });

    expect(getSession).toHaveBeenCalledWith({
      headers: expect.any(Headers),
    });
    const [{ headers }] = getSession.mock.calls[0];
    expect(headers.get("cookie")).toBe("sid=forged");
    expect(headers.get("accept-language")).toBe("ru");
  });

  it("keeps the AD-12 envelope for unsupported methods", async () => {
    const { POST } = await import("./route");
    const res = await POST();

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, code: "NOT_FOUND", message: "Not found" });
  });
});
