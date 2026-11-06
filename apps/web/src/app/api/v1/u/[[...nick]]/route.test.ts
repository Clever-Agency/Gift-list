import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, findUser, findList, findManyGifts, relationsBetween, readProfileRelationship } =
  vi.hoisted(() => ({
    getSession: vi.fn(),
    findUser: vi.fn(),
    findList: vi.fn(),
    findManyGifts: vi.fn(),
    relationsBetween: vi.fn(),
    readProfileRelationship: vi.fn(),
  }));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({
  prisma: {
    user: { findUnique: findUser },
    list: { findUnique: findList },
    gift: { findMany: findManyGifts },
  },
}));
vi.mock("@/lib/relationships", () => ({
  relationshipReader: { relationsBetween },
  readProfileRelationship,
}));

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

/** u1 owns `l1`; hidden titles must never reach a stranger or a blocked viewer. */
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

const anna = {
  id: "u1",
  name: "Анна",
  nick: "Anna",
  nickNormalized: "anna",
  email: "anna@example.com",
  // Direct `/u/:nick` must work even when search hides the person (AD-13).
  hideFromSearch: true,
};

const users = [anna];

/**
 * Calls the handler with the segments Next would pass: `["Anna"]` for a normal
 * profile, `[]` for a bare `/api/v1/u`, more than one for a malformed path.
 */
async function callRoute(segments: string[], headers: Record<string, string> = {}) {
  const { GET } = await import("./route");
  const path = segments.map((segment) => encodeURIComponent(segment)).join("/");
  const res = await GET(new Request(`http://x/api/v1/u/${path}`, { headers }), {
    params: Promise.resolve({ nick: segments }),
  });
  return { res, body: await res.json() };
}

function signIn(id = "u9") {
  getSession.mockResolvedValue({ user: { id }, session: {} });
}

function relations(overrides: Partial<Record<"blocked" | "friend" | "subscriber" | "contactMatch", boolean>>) {
  return {
    blocked: false,
    friend: false,
    subscriber: false,
    contactMatch: false,
    ...overrides,
  };
}

function titles(body: { data: { gifts: { title: string }[] } }) {
  return body.data.gifts.map((card) => card.title);
}

beforeEach(() => {
  getSession.mockReset();
  findUser.mockReset();
  findList.mockReset();
  findManyGifts.mockReset();
  relationsBetween.mockReset();
  readProfileRelationship.mockReset();

  getSession.mockResolvedValue(null);
  readProfileRelationship.mockResolvedValue("NONE");
  findUser.mockImplementation(({ where }: { where: { nickNormalized: string } }) =>
    Promise.resolve(users.find((user) => user.nickNormalized === where.nickNormalized) ?? null),
  );
  findList.mockImplementation(({ where }: { where: { ownerId?: string } }) =>
    Promise.resolve(
      where.ownerId === "u1"
        ? { id: "l1", ownerId: "u1", publicToken: "tok-1", owner: { name: "Анна", nick: "Anna" } }
        : null,
    ),
  );
  findManyGifts.mockImplementation(({ where }: { where: GiftWhere }) => Promise.resolve(query(where)));
  relationsBetween.mockResolvedValue(relations({}));
});

describe("GET /api/v1/u/:nick", () => {
  it("answers UNAUTHENTICATED without a gifts body and without touching the database", async () => {
    const { res, body } = await callRoute(["Anna"]);

    expect(res.status).toBe(401);
    expect(body).toEqual({ ok: false, code: "UNAUTHENTICATED", message: "Authentication required" });
    expect(JSON.stringify(body)).not.toContain("gifts");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(findUser).not.toHaveBeenCalled();
    expect(findList).not.toHaveBeenCalled();
    expect(findManyGifts).not.toHaveBeenCalled();
    expect(readProfileRelationship).not.toHaveBeenCalled();
  });

  it("answers an unknown nick with the closed not_found body, without a name or a list read", async () => {
    signIn();

    const { res, body } = await callRoute(["no-such-nick"]);

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, data: { access: "not_found", gifts: [] } });
    expect(JSON.stringify(body)).not.toContain("Анна");
    expect(JSON.stringify(body)).not.toContain("anna@example.com");
    expect(findList).not.toHaveBeenCalled();
    expect(findManyGifts).not.toHaveBeenCalled();
    expect(readProfileRelationship).not.toHaveBeenCalled();
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("treats a malformed, slashed or over-segmented nick like an unknown one without a user query", async () => {
    signIn();
    const unknown = await callRoute(["no-such-nick"]);
    findUser.mockClear();
    getSession.mockClear();
    signIn();

    const malformed = [
      [],
      [""],
      ["ab"],
      ["a/b"],
      ["a\\b"],
      ["%2f"],
      ["anna!"],
      ["x".repeat(25)],
      ["Anna", "extra"],
    ];

    for (const segments of malformed) {
      const { res, body } = await callRoute(segments);
      expect(res.status, JSON.stringify(segments)).toBe(unknown.res.status);
      expect(body, JSON.stringify(segments)).toEqual(unknown.body);
      expect(res.headers.get("cache-control")).toBe("private, no-store");
    }
    expect(findUser).not.toHaveBeenCalled();
    expect(findList).not.toHaveBeenCalled();
    expect(findManyGifts).not.toHaveBeenCalled();
    expect(readProfileRelationship).not.toHaveBeenCalled();
  });

  it("finds the nick case-insensitively through nickNormalized and returns the stored nick", async () => {
    signIn();

    const { res, body } = await callRoute(["AnNa"]);

    expect(res.status).toBe(200);
    expect(findUser).toHaveBeenCalledWith({
      where: { nickNormalized: "anna" },
      select: { id: true, name: true, nick: true },
    });
    expect(body.data.owner).toEqual({ displayName: "Анна", nick: "Anna" });
  });

  it("shows the owner card and no gifts when there is no relation, even with hideFromSearch", async () => {
    signIn();

    const { body } = await callRoute(["Anna"]);

    expect(body).toEqual({
      ok: true,
      data: {
        access: "gifts",
        owner: { displayName: "Анна", nick: "Anna" },
        gifts: [],
        relationship: "NONE",
      },
    });
    expect(relationsBetween).toHaveBeenCalledWith("u9", "u1");
    expect(readProfileRelationship).toHaveBeenCalledWith("u9", "u1");
    expect(findManyGifts).not.toHaveBeenCalled();
    expect(Object.keys(body.data)).not.toContain("publicToken");
    expect(JSON.stringify(body)).not.toContain("anna@example.com");
  });

  it("gives a friend PUBLIC and FRIENDS gifts, never SECRET, archived or the share token", async () => {
    signIn();
    relationsBetween.mockResolvedValue(relations({ friend: true }));
    readProfileRelationship.mockResolvedValue("FRIENDS");

    const { body } = await callRoute(["Anna"]);

    expect(titles(body)).toEqual(["Публичное", "Для друзей"]);
    expect(body.data.relationship).toBe("FRIENDS");
    expect(JSON.stringify(body)).not.toContain("Секрет");
    expect(JSON.stringify(body)).not.toContain("Архивное");
    expect(JSON.stringify(body)).not.toContain("anna@example.com");
    expect(Object.keys(body.data)).not.toContain("publicToken");
  });

  it("names an outgoing pending invite without opening FRIENDS wishes", async () => {
    signIn();
    readProfileRelationship.mockResolvedValue("OUTGOING_PENDING");

    const { body } = await callRoute(["Anna"]);

    expect(body.data.relationship).toBe("OUTGOING_PENDING");
    expect(body.data.gifts).toEqual([]);
    expect(titles(body)).not.toContain("Для друзей");
  });

  it("names an incoming pending invite without opening FRIENDS wishes", async () => {
    signIn();
    readProfileRelationship.mockResolvedValue("INCOMING_PENDING");

    const { body } = await callRoute(["Anna"]);

    expect(body.data.relationship).toBe("INCOMING_PENDING");
    expect(body.data.gifts).toEqual([]);
    expect(titles(body)).not.toContain("Для друзей");
  });

  it("gives a subscriber only PUBLIC gifts", async () => {
    signIn();
    relationsBetween.mockResolvedValue(relations({ subscriber: true }));

    const { body } = await callRoute(["Anna"]);

    expect(titles(body)).toEqual(["Публичное"]);
    expect(JSON.stringify(body)).not.toContain("Для друзей");
    expect(JSON.stringify(body)).not.toContain("Секрет");
  });

  it("gives a ContactMatch viewer only PUBLIC gifts", async () => {
    signIn();
    relationsBetween.mockResolvedValue(relations({ contactMatch: true }));

    const { body } = await callRoute(["Anna"]);

    expect(titles(body)).toEqual(["Публичное"]);
    expect(JSON.stringify(body)).not.toContain("Для друзей");
    expect(JSON.stringify(body)).not.toContain("Секрет");
  });

  it("gives the owner of the nick every visibility, including SECRET, but no email", async () => {
    signIn("u1");

    const { body } = await callRoute(["Anna"]);

    expect(titles(body)).toEqual(["Публичное", "Для друзей", "Секрет"]);
    expect(body.data.owner).toEqual({ displayName: "Анна", nick: "Anna" });
    expect(body.data.relationship).toBe("NONE");
    expect(readProfileRelationship).toHaveBeenCalledWith("u1", "u1");
    expect(JSON.stringify(body)).not.toContain("anna@example.com");
    expect(relationsBetween).not.toHaveBeenCalled();
  });

  it("answers a Block with the same body as an unknown nick and reads no gifts", async () => {
    signIn();
    relationsBetween.mockResolvedValue(relations({ blocked: true }));
    // Even a stale FRIENDS fact must be discarded with the whole profile.
    readProfileRelationship.mockResolvedValue("FRIENDS");

    const blocked = await callRoute(["Anna"]);
    findUser.mockResolvedValue(null);
    const unknown = await callRoute(["no-such-nick"]);

    expect(blocked.res.status).toBe(unknown.res.status);
    expect(blocked.body).toEqual(unknown.body);
    expect(blocked.body).toEqual({ ok: true, data: { access: "not_found", gifts: [] } });
    expect(blocked.body.data).not.toHaveProperty("relationship");
    expect(findManyGifts).not.toHaveBeenCalled();
    expect(JSON.stringify(blocked.body)).not.toContain("Анна");
    expect(JSON.stringify(blocked.body)).not.toContain("Секрет");
  });

  it("passes the request headers to getSession", async () => {
    signIn();

    await callRoute(["Anna"], { cookie: "sid=forged", "accept-language": "ru" });

    expect(getSession).toHaveBeenCalledWith({ headers: expect.any(Headers) });
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
