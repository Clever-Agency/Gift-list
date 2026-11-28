import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { listCollections } = vi.hoisted(() => ({ listCollections: vi.fn() }));

vi.mock("@/actions/collections", () => ({ listCollections }));

const collection = {
  id: "c1",
  title: "Для рыбалки",
  description: null,
  coverImageUrl: null,
  itemCount: 3,
};

beforeEach(() => {
  listCollections.mockReset();
});

describe("GET /api/v1/collections", () => {
  it("returns the published collections in the AD-12 envelope", async () => {
    listCollections.mockResolvedValue({ ok: true, data: { collections: [collection] } });

    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://x/api/v1/collections", { headers: { authorization: "Bearer t" } }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual({ ok: true, data: { collections: [collection] } });
    const headers = listCollections.mock.calls[0]?.[0] as Headers;
    expect(headers.get("authorization")).toBe("Bearer t");
  });

  it("keeps an empty answer a closed object", async () => {
    listCollections.mockResolvedValue({ ok: true, data: { collections: [] } });

    const { GET } = await import("./route");
    const res = await GET(new Request("http://x/api/v1/collections"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, data: { collections: [] } });
  });

  it("answers UNAUTHENTICATED with 401", async () => {
    listCollections.mockResolvedValue({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });

    const { GET } = await import("./route");
    const res = await GET(new Request("http://x/api/v1/collections"));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"] as const)(
    "%s is the closed NOT_FOUND envelope",
    async (method) => {
      const handlers = await import("./route");
      const res = await handlers[method](new Request("http://x/api/v1/collections", { method }));

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ ok: false, code: "NOT_FOUND", message: "Not found" });
    },
  );
});
