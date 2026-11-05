import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock("@/db/client", () => ({ prisma: { tag: { findMany } } }));

const rows = [
  { id: "t1", slug: "dream", labels: { ru: "мечта" } },
  { id: "t2", slug: "need-now", labels: { ru: "нужно сейчас" } },
  { id: "t3", slug: "someday", labels: { ru: "когда-нибудь" } },
];

const expected = {
  tags: [
    { id: "t1", slug: "dream", label: "мечта" },
    { id: "t2", slug: "need-now", label: "нужно сейчас" },
    { id: "t3", slug: "someday", label: "когда-нибудь" },
  ],
};

beforeEach(() => {
  findMany.mockReset();
  findMany.mockResolvedValue(rows);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/v1/tags", () => {
  it("returns the localized catalog through the real route and use-case", async () => {
    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://x/api/v1/tags", { headers: { "accept-language": "ru-RU" } }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("vary")).toBe("Accept-Language");
    expect(await res.json()).toEqual({ ok: true, data: expected });
  });

  it("falls back to DEFAULT_LOCALE for an unknown language", async () => {
    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://x/api/v1/tags", { headers: { "accept-language": "en-US,en;q=0.9" } }),
    );

    expect(await res.json()).toEqual({ ok: true, data: expected });
  });

  it("orders the body by slug even if the database returns another order", async () => {
    findMany.mockResolvedValue([rows[2], rows[0], rows[1]]);
    const { GET } = await import("./route");
    const res = await GET(new Request("http://x/api/v1/tags"));

    expect(await res.json()).toEqual({ ok: true, data: expected });
  });

  it("answers an empty table with an empty catalog", async () => {
    findMany.mockResolvedValue([]);
    const { GET } = await import("./route");
    const res = await GET(new Request("http://x/api/v1/tags"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, data: { tags: [] } });
  });

  it("maps a database failure to the standard error envelope", async () => {
    findMany.mockRejectedValue(new Error("database is down"));
    const { GET } = await import("./route");
    const res = await GET(new Request("http://x/api/v1/tags"));

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Tag catalog is unavailable",
    });
  });

  it("answers unsupported methods with the NOT_FOUND envelope", async () => {
    const { POST, HEAD } = await import("./route");
    for (const handler of [POST, HEAD]) {
      const res = await handler(new Request("http://x/api/v1/tags", { method: "POST" }));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ ok: false, code: "NOT_FOUND", message: "Not found" });
    }
  });
});
