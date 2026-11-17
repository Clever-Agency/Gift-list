import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { previewGiftVisibility } = vi.hoisted(() => ({ previewGiftVisibility: vi.fn() }));

vi.mock("@/actions/gifts", () => ({ previewGiftVisibility }));

function get(query = "?visibility=FRIENDS", headers: Record<string, string> = {}) {
  return new Request(`http://x/api/v1/me/gifts/g7/visibility${query}`, {
    method: "GET",
    headers,
  });
}

/** Next 16 hands the dynamic segment over as a promise. */
function context(id = "g7") {
  return { params: Promise.resolve({ id }) };
}

const notFound = { ok: false, code: "NOT_FOUND", message: "Not found" };

beforeEach(() => {
  previewGiftVisibility.mockReset();
});

describe("GET /api/v1/me/gifts/[id]/visibility", () => {
  it("answers the preflight flag in the AD-12 envelope", async () => {
    previewGiftVisibility.mockResolvedValue({ ok: true, data: { wouldCancelReservation: true } });
    const { GET } = await import("./route");
    const res = await GET(get(), context());

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual({ ok: true, data: { wouldCancelReservation: true } });
  });

  it("passes the route id, the request headers and the query value", async () => {
    previewGiftVisibility.mockResolvedValue({ ok: true, data: { wouldCancelReservation: false } });
    const { GET } = await import("./route");
    const res = await GET(get("?visibility=SECRET", { authorization: "Bearer t" }), context("g9"));

    expect(res.status).toBe(200);
    expect(previewGiftVisibility).toHaveBeenCalledWith(expect.any(Headers), "g9", "SECRET");
    const headers = previewGiftVisibility.mock.calls[0][0] as Headers;
    expect(headers.get("authorization")).toBe("Bearer t");
  });

  it.each(["", "?visibility=", "?visibility=EVERYONE"])(
    "answers 400 with the field for a bad query %j and writes no preflight",
    async (query) => {
      const { GET } = await import("./route");
      const res = await GET(get(query), context());

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        ok: false,
        code: "VALIDATION",
        message: "Invalid input",
        field: "visibility",
      });
      expect(previewGiftVisibility).not.toHaveBeenCalled();
    },
  );

  it("answers UNAUTHENTICATED with 401", async () => {
    previewGiftVisibility.mockResolvedValue({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
    const { GET } = await import("./route");
    const res = await GET(get(), context());

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
  });

  it("maps a foreign wish to 404", async () => {
    previewGiftVisibility.mockResolvedValue({
      ok: false,
      code: "NOT_FOUND",
      message: "Gift not found",
    });
    const { GET } = await import("./route");
    const res = await GET(get(), context());

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Gift not found",
    });
  });

  it("maps an archived own wish to 400 and keeps the reason", async () => {
    previewGiftVisibility.mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      reason: "GIFT_ARCHIVED",
    });
    const { GET } = await import("./route");
    const res = await GET(get(), context());

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      reason: "GIFT_ARCHIVED",
    });
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"] as const)(
    "%s is the NOT_FOUND envelope, not a read or a write",
    async (method) => {
      const handlers = await import("./route");
      const res = await handlers[method](
        new Request("http://x/api/v1/me/gifts/g7/visibility?visibility=SECRET", { method }),
      );

      expect(res.status).toBe(404);
      expect(res.headers.get("cache-control")).toBe("private, no-store");
      expect(await res.json()).toEqual(notFound);
      expect(previewGiftVisibility).not.toHaveBeenCalled();
    },
  );
});
