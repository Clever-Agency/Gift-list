import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getGift, updateGift, deleteGift } = vi.hoisted(() => ({
  getGift: vi.fn(),
  updateGift: vi.fn(),
  deleteGift: vi.fn(),
}));

vi.mock("@/actions/gifts", () => ({ getGift, updateGift, deleteGift }));

const card = {
  id: "g7",
  title: "Книга",
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

const input = { title: "Книга" };

const notFound = { ok: false, code: "NOT_FOUND", message: "Not found" };

function patch(json: string, headers: Record<string, string> = {}) {
  return new Request("http://x/api/v1/me/gifts/g7", {
    method: "PATCH",
    headers: { "content-type": "application/json", ...headers },
    body: json,
  });
}

function get(headers: Record<string, string> = {}) {
  return new Request("http://x/api/v1/me/gifts/g7", { method: "GET", headers });
}

function remove(headers: Record<string, string> = {}) {
  return new Request("http://x/api/v1/me/gifts/g7", { method: "DELETE", headers });
}

/** Next 16 hands the dynamic segment over as a promise. */
function context(id = "g7") {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  getGift.mockReset();
  updateGift.mockReset();
  deleteGift.mockReset();
});

describe("GET /api/v1/me/gifts/[id]", () => {
  it("returns 200 with the card in the AD-12 envelope", async () => {
    getGift.mockResolvedValue({ ok: true, data: card });
    const { GET } = await import("./route");
    const res = await GET(get({ authorization: "Bearer t" }), context());

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual({ ok: true, data: card });
  });

  it("passes the route id and the request headers to getGift", async () => {
    getGift.mockResolvedValue({ ok: true, data: card });
    const { GET } = await import("./route");
    await GET(get({ authorization: "Bearer t" }), context("g9"));

    expect(getGift).toHaveBeenCalledWith(expect.any(Headers), "g9");
    const headers = getGift.mock.calls[0][0] as Headers;
    expect(headers.get("authorization")).toBe("Bearer t");
  });

  it("answers UNAUTHENTICATED with 401", async () => {
    getGift.mockResolvedValue({
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

  it("maps NOT_FOUND to 404", async () => {
    getGift.mockResolvedValue({
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
});

describe("PATCH /api/v1/me/gifts/[id]", () => {
  it("returns 200 with the edited card in the AD-12 envelope", async () => {
    updateGift.mockResolvedValue({ ok: true, data: card });
    const { PATCH } = await import("./route");
    const res = await PATCH(patch(JSON.stringify(input), { authorization: "Bearer t" }), context());

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual({ ok: true, data: card });
  });

  it("passes the route id and the request headers to updateGift", async () => {
    updateGift.mockResolvedValue({ ok: true, data: card });
    const { PATCH } = await import("./route");
    await PATCH(patch(JSON.stringify(input), { authorization: "Bearer t" }), context("g7"));

    expect(updateGift).toHaveBeenCalledWith(expect.any(Headers), "g7", input);
    const headers = updateGift.mock.calls[0][0] as Headers;
    expect(headers.get("authorization")).toBe("Bearer t");
  });

  it("answers UNAUTHENTICATED with 401", async () => {
    updateGift.mockResolvedValue({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
    const { PATCH } = await import("./route");
    const res = await PATCH(patch(JSON.stringify(input)), context());

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
  });

  it("maps VALIDATION to 400 and keeps the field", async () => {
    updateGift.mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: "title",
    });
    const { PATCH } = await import("./route");
    const res = await PATCH(patch(JSON.stringify(input)), context());

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: "title",
    });
  });

  it("maps NOT_FOUND to 404", async () => {
    updateGift.mockResolvedValue({
      ok: false,
      code: "NOT_FOUND",
      message: "Gift not found",
    });
    const { PATCH } = await import("./route");
    const res = await PATCH(patch(JSON.stringify(input)), context());

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Gift not found",
    });
  });

  it("answers malformed JSON with 400 without calling updateGift", async () => {
    const { PATCH } = await import("./route");
    const res = await PATCH(patch("{not json"), context());

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
    });
    expect(updateGift).not.toHaveBeenCalled();
  });

  it.each(["POST", "PUT"] as const)(
    "%s is the NOT_FOUND envelope, not a read or a write",
    async (method) => {
      const handlers = await import("./route");
      const res = await handlers[method](
        new Request("http://x/api/v1/me/gifts/g7", { method }),
      );

      expect(res.status).toBe(404);
      expect(res.headers.get("cache-control")).toBe("private, no-store");
      expect(await res.json()).toEqual(notFound);
      expect(getGift).not.toHaveBeenCalled();
      expect(updateGift).not.toHaveBeenCalled();
      expect(deleteGift).not.toHaveBeenCalled();
    },
  );
});

describe("DELETE /api/v1/me/gifts/[id]", () => {
  it("returns 200 with the deleted id in the AD-12 envelope", async () => {
    deleteGift.mockResolvedValue({ ok: true, data: { id: "g7" } });
    const { DELETE } = await import("./route");
    const res = await DELETE(remove({ authorization: "Bearer t" }), context());

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual({ ok: true, data: { id: "g7" } });
  });

  it("passes the route id and the request headers to deleteGift", async () => {
    deleteGift.mockResolvedValue({ ok: true, data: { id: "g9" } });
    const { DELETE } = await import("./route");
    await DELETE(remove({ authorization: "Bearer t" }), context("g9"));

    expect(deleteGift).toHaveBeenCalledWith(expect.any(Headers), "g9");
    const headers = deleteGift.mock.calls[0][0] as Headers;
    expect(headers.get("authorization")).toBe("Bearer t");
  });

  it("answers UNAUTHENTICATED with 401", async () => {
    deleteGift.mockResolvedValue({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
    const { DELETE } = await import("./route");
    const res = await DELETE(remove(), context());

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
  });

  it("maps CONFLICT to 409 without deleting a reserved wish", async () => {
    deleteGift.mockResolvedValue({
      ok: false,
      code: "CONFLICT",
      message: "Only an open wish can be deleted here",
    });
    const { DELETE } = await import("./route");
    const res = await DELETE(remove(), context());

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      ok: false,
      code: "CONFLICT",
      message: "Only an open wish can be deleted here",
    });
  });

  it("maps NOT_FOUND to 404", async () => {
    deleteGift.mockResolvedValue({
      ok: false,
      code: "NOT_FOUND",
      message: "Gift not found",
    });
    const { DELETE } = await import("./route");
    const res = await DELETE(remove(), context());

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Gift not found",
    });
  });
});
