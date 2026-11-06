import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, findUnique, findMany, create, createGift } = vi.hoisted(() => ({
  getSession: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  createGift: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({
  prisma: { list: { findUnique, create }, gift: { findMany } },
}));
vi.mock("@/actions/gifts", () => ({ createGift }));

const row = {
  id: "g1",
  title: "Наушники",
  description: "Беспроводные",
  priceAmount: 19900,
  priceCurrency: "BYN" as const,
  linkUrl: "https://shop.example/headphones",
  visibility: "SECRET" as const,
  quantity: "SINGLE" as const,
  expiresOn: new Date("2026-12-31T00:00:00.000Z"),
  archivedAt: null,
  status: "OPEN" as const,
  reservationPhase: null,
  holderVisibleToOwner: false,
  reservedBy: null,
  tags: [],
};

/** Calls the use-case and the HTTP adapter with the same request, like the `/me` route test. */
async function both() {
  const { GET } = await import("./route");
  const { getMyGifts } = await import("@/actions/my-gifts");
  const request = new Request("http://x/api/v1/me/gifts");
  const viaAction = await getMyGifts(request.headers);
  const res = await GET(new Request("http://x/api/v1/me/gifts"));
  return { viaAction, res, viaHttp: await res.json() };
}

beforeEach(() => {
  getSession.mockReset();
  findUnique.mockReset();
  findMany.mockReset();
  create.mockReset();
  createGift.mockReset();
  getSession.mockResolvedValue({ user: { id: "u1" }, session: { token: "t" } });
  findUnique.mockResolvedValue({ id: "l1", ownerId: "u1", publicToken: "tok-1" });
  findMany.mockResolvedValue([row]);
  create.mockResolvedValue({ id: "l1" });
});

describe("GET /api/v1/me/gifts", () => {
  it("returns the owner's wishlist in the AD-12 envelope", async () => {
    const { GET } = await import("./route");
    const res = await GET(new Request("http://x/api/v1/me/gifts"));

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual({
      ok: true,
      data: {
        access: "gifts",
        publicToken: "tok-1",
        gifts: [
          {
            id: "g1",
            title: "Наушники",
            description: "Беспроводные",
            priceAmount: 19900,
            priceCurrency: "BYN",
            linkUrl: "https://shop.example/headphones",
            visibility: "SECRET",
            quantity: "SINGLE",
            expiresOn: "2026-12-31",
            archivedAt: null,
            tags: [],
            status: "OPEN",
            reservedBy: null,
            reservationLabel: null,
            ownerAction: null,
          },
        ],
      },
    });
  });

  it("answers UNAUTHENTICATED without a session", async () => {
    getSession.mockResolvedValue(null);
    const { res, viaHttp } = await both();

    expect(res.status).toBe(401);
    expect(viaHttp).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    expect(findUnique).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });

  it("answers a normal empty wishlist as `access: gifts` with the token, never as a gate", async () => {
    findMany.mockResolvedValue([]);
    const { res, viaHttp } = await both();

    expect(res.status).toBe(200);
    expect(viaHttp).toEqual({
      ok: true,
      data: { access: "gifts", gifts: [], publicToken: "tok-1" },
    });
  });

  /**
   * AD-6: a missing `List` row is an anomaly, not a normal empty wishlist. The
   * HTTP adapter must carry the repaired token, not a tokenless empty list.
   */
  it("repairs a missing list row and returns the owner token over HTTP", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "l1", ownerId: "u1", publicToken: "tok-new" });
    findMany.mockResolvedValue([]);

    const { GET } = await import("./route");
    const res = await GET(new Request("http://x/api/v1/me/gifts"));

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(create).toHaveBeenCalledWith({
      data: { ownerId: "u1", publicToken: expect.any(String) },
      select: { id: true },
    });
    expect(warn).toHaveBeenCalledWith("Missing List row repaired for owner", "u1");
    expect(await res.json()).toEqual({
      ok: true,
      data: { access: "gifts", gifts: [], publicToken: "tok-new" },
    });
  });

  /**
   * AD-7 owner branch: the list is resolved through the session user's `ownerId`,
   * never through input. A hint in the query string must not widen the read to
   * another person's wishlist.
   */
  it("reads only the session owner's list, never another user's", async () => {
    // A second person's list exists: if the route ever resolved it, the read would
    // return their gift instead of the owner's.
    const otherRow = { ...row, id: "g-other", title: "Чужое желание" };
    findUnique.mockImplementation(({ where }: { where: { ownerId: string } }) =>
      Promise.resolve({
        id: where.ownerId === "u1" ? "l1" : "l2",
        ownerId: where.ownerId,
        publicToken: where.ownerId === "u1" ? "tok-1" : "tok-2",
      }),
    );
    findMany.mockImplementation(({ where }: { where: { listId: string } }) =>
      Promise.resolve(where.listId === "l1" ? [row] : [otherRow]),
    );

    const { GET } = await import("./route");
    const res = await GET(new Request("http://x/api/v1/me/gifts?ownerId=u2&listId=l2"));
    const body = await res.json();

    expect(findUnique).toHaveBeenCalledWith({
      where: { ownerId: "u1" },
      select: {
        id: true,
        ownerId: true,
        publicToken: true,
        owner: { select: { name: true, nick: true } },
      },
    });
    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { listId: "l1", archivedAt: null } }),
    );
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(body.data.publicToken).toBe("tok-1");
    expect(body.data.gifts.map((card: { id: string }) => card.id)).toEqual(["g1"]);
    expect(JSON.stringify(body)).not.toContain("Чужое желание");
  });

  it("passes request headers to getSession", async () => {
    const { GET } = await import("./route");
    await GET(
      new Request("http://x/api/v1/me/gifts", {
        headers: { authorization: "Bearer t", cookie: "a=b" },
      }),
    );

    const { headers } = getSession.mock.calls[0][0] as { headers: Headers };
    expect(headers.get("authorization")).toBe("Bearer t");
    expect(headers.get("cookie")).toBe("a=b");
  });

  it("matches the use-case result", async () => {
    for (const session of [{ user: { id: "u1" }, session: {} }, null]) {
      getSession.mockResolvedValue(session);
      const { viaAction, viaHttp } = await both();
      expect(viaHttp).toEqual(viaAction);
    }
  });
});

const card = {
  id: "g1",
  title: "Наушники",
  description: null,
  priceAmount: null,
  priceCurrency: null,
  linkUrl: null,
  visibility: "PUBLIC" as const,
  quantity: "SINGLE" as const,
  expiresOn: null,
  archivedAt: null,
  tags: [],
  status: "OPEN" as const,
  reservedBy: null,
  reservationLabel: null,
  ownerAction: null,
};

const input = { title: "Наушники", visibility: "PUBLIC" };

function post(json: string, headers: Record<string, string> = {}) {
  return new Request("http://x/api/v1/me/gifts", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: json,
  });
}

describe("POST /api/v1/me/gifts", () => {
  it("returns 201 with the created card in the AD-12 envelope", async () => {
    createGift.mockResolvedValue({ ok: true, data: card });
    const { POST } = await import("./route");
    const res = await POST(post(JSON.stringify(input), { authorization: "Bearer t" }));

    expect(res.status).toBe(201);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual({ ok: true, data: card });
    expect(createGift).toHaveBeenCalledWith(expect.any(Headers), input);
    const headers = createGift.mock.calls[0][0] as Headers;
    expect(headers.get("authorization")).toBe("Bearer t");
  });

  it("answers UNAUTHENTICATED with 401", async () => {
    createGift.mockResolvedValue({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
    const { POST } = await import("./route");
    const res = await POST(post(JSON.stringify(input)));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
  });

  it("maps VALIDATION to 400 and keeps the field", async () => {
    createGift.mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: "title",
    });
    const { POST } = await import("./route");
    const res = await POST(post(JSON.stringify(input)));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: "title",
    });
  });

  it("maps NOT_FOUND to 404", async () => {
    createGift.mockResolvedValue({
      ok: false,
      code: "NOT_FOUND",
      message: "Wishlist not found",
    });
    const { POST } = await import("./route");
    const res = await POST(post(JSON.stringify(input)));

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Wishlist not found",
    });
  });

  it("answers malformed JSON with 400 without calling createGift", async () => {
    const { POST } = await import("./route");
    const res = await POST(post("{not json"));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
    });
    expect(createGift).not.toHaveBeenCalled();
  });
});
