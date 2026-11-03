import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { updateGift } = vi.hoisted(() => ({ updateGift: vi.fn() }));

vi.mock("@/actions/gifts", () => ({ updateGift }));

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

/** Next 16 hands the dynamic segment over as a promise. */
function context(id = "g7") {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  updateGift.mockReset();
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

  it.each(["GET", "POST", "PUT", "DELETE"] as const)(
    "%s is the NOT_FOUND envelope, not a read or a write",
    async (method) => {
      const handlers = await import("./route");
      const res = await handlers[method](
        new Request("http://x/api/v1/me/gifts/g7", { method }),
      );

      expect(res.status).toBe(404);
      expect(res.headers.get("cache-control")).toBe("private, no-store");
      expect(await res.json()).toEqual(notFound);
      expect(updateGift).not.toHaveBeenCalled();
    },
  );
});
