import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { addCollectionItemToWishlist } = vi.hoisted(() => ({
  addCollectionItemToWishlist: vi.fn(),
}));

vi.mock("@/actions/collections", () => ({ addCollectionItemToWishlist }));

const card = {
  id: "g1",
  title: "Термос",
  description: "Держит тепло сутки",
  priceAmount: null,
  priceCurrency: null,
  linkUrl: "https://shop.example/termos",
  visibility: "PUBLIC",
  quantity: "SINGLE",
  expiresOn: null,
  archivedAt: null,
  tags: [],
  status: "OPEN",
  reservedBy: null,
  reservationLabel: null,
  ownerAction: null,
  undoUntil: null,
};

const context = { params: Promise.resolve({ id: "c1", itemId: "i1" }) };

beforeEach(() => {
  addCollectionItemToWishlist.mockReset();
});

describe("POST /api/v1/collections/[id]/items/[itemId]/add", () => {
  it("returns 201 with the created wish, like POST /api/v1/me/gifts", async () => {
    addCollectionItemToWishlist.mockResolvedValue({ ok: true, data: card });

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://x/api/v1/collections/c1/items/i1/add", {
        method: "POST",
        headers: { authorization: "Bearer t" },
      }),
      context,
    );

    expect(res.status).toBe(201);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual({ ok: true, data: card });
    expect(addCollectionItemToWishlist).toHaveBeenCalledWith(expect.any(Headers), "c1", "i1");
    const headers = addCollectionItemToWishlist.mock.calls[0]?.[0] as Headers;
    expect(headers.get("authorization")).toBe("Bearer t");
  });

  it("answers a draft, a missing collection or a foreign idea with 404", async () => {
    addCollectionItemToWishlist.mockResolvedValue({
      ok: false,
      code: "NOT_FOUND",
      message: "Not found",
    });

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://x/api/v1/collections/c1/items/i1/add", { method: "POST" }),
      context,
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, code: "NOT_FOUND", message: "Not found" });
  });

  it("answers UNAUTHENTICATED with 401", async () => {
    addCollectionItemToWishlist.mockResolvedValue({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://x/api/v1/collections/c1/items/i1/add", { method: "POST" }),
      context,
    );

    expect(res.status).toBe(401);
  });

  it("keeps the wish limit refusal of the create use-case", async () => {
    addCollectionItemToWishlist.mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: "title",
    });

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://x/api/v1/collections/c1/items/i1/add", { method: "POST" }),
      context,
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: "title",
    });
  });

  it.each(["GET", "PUT", "PATCH", "DELETE"] as const)(
    "%s is the closed NOT_FOUND envelope",
    async (method) => {
      const handlers = await import("./route");
      const handler = handlers[method] as unknown as (
        request: Request,
        options: typeof context,
      ) => Response | Promise<Response>;
      const res = await handler(
        new Request("http://x/api/v1/collections/c1/items/i1/add", { method }),
        context,
      );

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ ok: false, code: "NOT_FOUND", message: "Not found" });
    },
  );
});
