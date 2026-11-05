import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock("@/db/client", () => ({ prisma: { tag: { findMany } } }));

const rows = [
  { id: "t1", slug: "dream", labels: { ru: "мечта" } },
  { id: "t2", slug: "need-now", labels: { ru: "нужно сейчас" } },
  { id: "t3", slug: "someday", labels: { ru: "когда-нибудь" } },
];

function headers(acceptLanguage?: string): Headers {
  return new Headers(acceptLanguage ? { "accept-language": acceptLanguage } : {});
}

beforeEach(() => {
  findMany.mockReset();
  findMany.mockResolvedValue(rows);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getTagCatalog", () => {
  it("returns labels on the request language", async () => {
    const { getTagCatalog } = await import("./tags");
    const result = await getTagCatalog(headers("ru-RU,ru;q=0.9"));

    expect(result).toEqual({
      ok: true,
      data: {
        tags: [
          { id: "t1", slug: "dream", label: "мечта" },
          { id: "t2", slug: "need-now", label: "нужно сейчас" },
          { id: "t3", slug: "someday", label: "когда-нибудь" },
        ],
      },
    });
  });

  it("falls back to DEFAULT_LOCALE for an unknown language", async () => {
    const { getTagCatalog } = await import("./tags");
    const result = await getTagCatalog(headers("en-US,en;q=0.9"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.tags.map((tag) => tag.label)).toEqual([
      "мечта",
      "нужно сейчас",
      "когда-нибудь",
    ]);
  });

  it("falls back to DEFAULT_LOCALE without Accept-Language", async () => {
    const { getTagCatalog } = await import("./tags");
    const result = await getTagCatalog(headers());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.tags.map((tag) => tag.label)).toEqual([
      "мечта",
      "нужно сейчас",
      "когда-нибудь",
    ]);
  });

  it("orders the catalog by slug, not by the database row order", async () => {
    findMany.mockResolvedValue([rows[2], rows[0], rows[1]]);
    const { getTagCatalog } = await import("./tags");
    const result = await getTagCatalog(headers("ru"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.tags.map((tag) => tag.slug)).toEqual(["dream", "need-now", "someday"]);
  });

  it("answers an empty table with an empty catalog", async () => {
    findMany.mockResolvedValue([]);
    const { getTagCatalog } = await import("./tags");

    expect(await getTagCatalog(headers("ru"))).toEqual({ ok: true, data: { tags: [] } });
  });

  it("leaves out a row without any usable label instead of serving a blank chip", async () => {
    findMany.mockResolvedValue([{ id: "t1", slug: "dream", labels: {} }, rows[1]]);
    const { getTagCatalog } = await import("./tags");
    const result = await getTagCatalog(headers("ru"));

    expect(result).toEqual({
      ok: true,
      data: { tags: [{ id: "t2", slug: "need-now", label: "нужно сейчас" }] },
    });
  });

  it("reads only id, slug and labels", async () => {
    const { getTagCatalog } = await import("./tags");
    await getTagCatalog(headers("ru"));

    expect(findMany).toHaveBeenCalledWith({
      select: { id: true, slug: true, labels: true },
    });
  });

  it("does not expose moderation, aggregate or custom fields from a row", async () => {
    findMany.mockResolvedValue([
      {
        ...rows[0],
        aggregateEligible: true,
        customText: "своё",
        createdAt: new Date("2026-11-05T00:00:00.000Z"),
      },
    ]);
    const { getTagCatalog } = await import("./tags");
    const result = await getTagCatalog(headers("ru"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.data.tags[0] ?? {})).toEqual(["id", "slug", "label"]);
  });

  it("turns a database failure into the standard error envelope and logs the cause", async () => {
    const cause = new Error("database is down");
    findMany.mockRejectedValue(cause);
    const { getTagCatalog } = await import("./tags");

    expect(await getTagCatalog(headers("ru"))).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Tag catalog is unavailable",
    });
    expect(console.error).toHaveBeenCalledWith("Tag catalog read failed", cause);
  });

  it("turns a malformed row into the same envelope instead of a 500", async () => {
    findMany.mockResolvedValue([{ id: 1, slug: "dream", labels: { ru: "мечта" } }]);
    const { getTagCatalog } = await import("./tags");

    expect(await getTagCatalog(headers("ru"))).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Tag catalog is unavailable",
    });
  });

  it("does not require a session: a bearer header does not change the read", async () => {
    const { getTagCatalog } = await import("./tags");
    const withAuth = new Headers({ "accept-language": "ru", authorization: "Bearer t" });
    const result = await getTagCatalog(withAuth);

    expect(result.ok).toBe(true);
    expect(findMany).toHaveBeenCalledTimes(1);
  });
});
