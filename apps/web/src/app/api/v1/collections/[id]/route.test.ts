import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getCollection } = vi.hoisted(() => ({ getCollection: vi.fn() }));

vi.mock("@/actions/collections", () => ({ getCollection }));

const item = {
  id: "i1",
  title: "Термос",
  description: "Держит тепло сутки",
  linkUrl: "https://shop.example/termos",
  imageUrl: null,
};

const detail = {
  id: "c1",
  title: "Для рыбалки",
  description: "Идеи для тех, кто любит воду",
  coverImageUrl: null,
  itemCount: 1,
  items: [item],
};

const context = { params: Promise.resolve({ id: "c1" }) };

beforeEach(() => {
  getCollection.mockReset();
});

describe("GET /api/v1/collections/[id]", () => {
  it("returns one published collection with its ideas", async () => {
    getCollection.mockResolvedValue({ ok: true, data: detail });

    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://x/api/v1/collections/c1", { headers: { cookie: "a=b" } }),
      context,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual({ ok: true, data: detail });
    expect(getCollection).toHaveBeenCalledWith(expect.any(Headers), "c1");
    const headers = getCollection.mock.calls[0]?.[0] as Headers;
    expect(headers.get("cookie")).toBe("a=b");
  });

  it("answers a draft or an unknown id with 404", async () => {
    getCollection.mockResolvedValue({ ok: false, code: "NOT_FOUND", message: "Not found" });

    const { GET } = await import("./route");
    const res = await GET(new Request("http://x/api/v1/collections/c1"), context);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, code: "NOT_FOUND", message: "Not found" });
  });

  it("answers UNAUTHENTICATED with 401", async () => {
    getCollection.mockResolvedValue({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });

    const { GET } = await import("./route");
    const res = await GET(new Request("http://x/api/v1/collections/c1"), context);

    expect(res.status).toBe(401);
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"] as const)(
    "%s is the closed NOT_FOUND envelope",
    async (method) => {
      const handlers = await import("./route");
      const handler = handlers[method] as unknown as (
        request: Request,
        options: typeof context,
      ) => Response | Promise<Response>;
      const res = await handler(
        new Request("http://x/api/v1/collections/c1", { method }),
        context,
      );

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ ok: false, code: "NOT_FOUND", message: "Not found" });
    },
  );
});
