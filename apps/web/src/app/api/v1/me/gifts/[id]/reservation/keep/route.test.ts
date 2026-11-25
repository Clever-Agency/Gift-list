import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { keepReservation } = vi.hoisted(() => ({ keepReservation: vi.fn() }));

vi.mock("@/actions/gift-reservation-keep", () => ({ keepReservation }));

const notFound = { ok: false, code: "NOT_FOUND", message: "Not found" };

const card = {
  id: "g1",
  title: "Наушники",
  description: null,
  priceAmount: null,
  priceCurrency: null,
  linkUrl: null,
  visibility: "PUBLIC",
  quantity: "SINGLE",
  expiresOn: null,
  archivedAt: null,
  tags: [],
  status: "RESERVED",
  reservedBy: null,
  reservationLabel: null,
  ownerAction: null,
};

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://x/api/v1/me/gifts/g1/reservation/keep", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

/** Next 16 hands the dynamic segment over as a promise. */
function context(id = "g1") {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  keepReservation.mockReset();
  keepReservation.mockResolvedValue({ ok: true, data: card });
});

describe("POST /api/v1/me/gifts/[id]/reservation/keep", () => {
  it("passes the route id, the headers and the empty body into the action", async () => {
    const { POST } = await import("./route");
    const response = await POST(post({}, { authorization: "Bearer t" }), context());

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ ok: true, data: card });
    expect(keepReservation).toHaveBeenCalledWith(expect.any(Headers), "g1", {});
    const headers = keepReservation.mock.calls[0][0] as Headers;
    expect(headers.get("authorization")).toBe("Bearer t");
  });

  it("passes the route id rather than the body into the action", async () => {
    const { POST } = await import("./route");
    await POST(post({}), context("g9"));

    expect(keepReservation).toHaveBeenCalledWith(expect.any(Headers), "g9", {});
  });

  it("rejects a body that is not JSON without calling the action", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://x/api/v1/me/gifts/g1/reservation/keep", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: "keep",
      }),
      context(),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(keepReservation).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON without calling the action", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://x/api/v1/me/gifts/g1/reservation/keep", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      }),
      context(),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(keepReservation).not.toHaveBeenCalled();
  });

  it.each([
    ["UNAUTHENTICATED", 401, { ok: false, code: "UNAUTHENTICATED", message: "Authentication required" }],
    ["NOT_FOUND", 404, { ok: false, code: "NOT_FOUND", message: "Gift not found" }],
    ["VALIDATION", 400, { ok: false, code: "VALIDATION", message: "Invalid input", field: "dueOn" }],
    ["CONFLICT", 409, { ok: false, code: "CONFLICT", message: "The reservation cannot be kept" }],
  ] as const)("maps %s to the AD-12 envelope", async (_case, status, refusal) => {
    keepReservation.mockResolvedValue(refusal);
    const { POST } = await import("./route");
    const response = await POST(post({}), context());

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual(refusal);
  });

  it.each(["GET", "PUT", "PATCH", "DELETE"] as const)(
    "%s is the NOT_FOUND envelope, not an action",
    async (method) => {
      const handlers = await import("./route");
      const response = await handlers[method](
        new Request("http://x/api/v1/me/gifts/g1/reservation/keep", { method }),
      );

      expect(response.status).toBe(404);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(await response.json()).toEqual(notFound);
      expect(keepReservation).not.toHaveBeenCalled();
    },
  );
});
