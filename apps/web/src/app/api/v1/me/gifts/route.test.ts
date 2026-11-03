import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, findUnique, findMany } = vi.hoisted(() => ({
  getSession: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({ prisma: { list: { findUnique }, gift: { findMany } } }));

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
  getSession.mockResolvedValue({ user: { id: "u1" }, session: { token: "t" } });
  findUnique.mockResolvedValue({ id: "l1" });
  findMany.mockResolvedValue([row]);
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

  it("answers an empty wishlist as `access: gifts`, never as a gate", async () => {
    findMany.mockResolvedValue([]);
    const { res, viaHttp } = await both();

    expect(res.status).toBe(200);
    expect(viaHttp).toEqual({ ok: true, data: { access: "gifts", gifts: [] } });
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
      Promise.resolve({ id: where.ownerId === "u1" ? "l1" : "l2" }),
    );
    findMany.mockImplementation(({ where }: { where: { listId: string } }) =>
      Promise.resolve(where.listId === "l1" ? [row] : [otherRow]),
    );

    const { GET } = await import("./route");
    const res = await GET(new Request("http://x/api/v1/me/gifts?ownerId=u2&listId=l2"));
    const body = await res.json();

    expect(findUnique).toHaveBeenCalledWith({ where: { ownerId: "u1" }, select: { id: true } });
    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { listId: "l1", archivedAt: null } }),
    );
    expect(findMany).toHaveBeenCalledTimes(1);
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
