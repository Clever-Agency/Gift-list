import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { updateMyReservation } = vi.hoisted(() => ({ updateMyReservation: vi.fn() }));

vi.mock("@/actions/reservation-update", () => ({ updateMyReservation }));

const notFound = { ok: false, code: "NOT_FOUND", message: "Not found" };

const card = {
  giftId: "g1",
  titleSnapshot: "Плед",
  status: "RESERVED",
  ownerNick: "anna",
  dueAt: "2026-12-08",
  phase: "ACTIVE",
  bought: false,
  holderVisibleToOwner: false,
  holderVisibleToOthers: true,
  priceAmount: null,
  priceCurrency: null,
  photoUrl: null,
  canOpenGift: true,
};

function patch(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://x/api/v1/me/reservations/g1", {
    method: "PATCH",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

/** Next 16 hands the dynamic segment over as a promise. */
function context(giftId = "g1") {
  return { params: Promise.resolve({ giftId }) };
}

beforeEach(() => {
  updateMyReservation.mockReset();
  updateMyReservation.mockResolvedValue({ ok: true, data: card });
});

describe("PATCH /api/v1/me/reservations/[giftId]", () => {
  it("passes the gift id, the headers and the parsed body into the action", async () => {
    const { PATCH } = await import("./route");
    const body = { action: "bought", value: true };
    const response = await PATCH(patch(body, { authorization: "Bearer t" }), context());

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ ok: true, data: card });
    expect(updateMyReservation).toHaveBeenCalledWith(expect.any(Headers), "g1", body);
    const headers = updateMyReservation.mock.calls[0][0] as Headers;
    expect(headers.get("authorization")).toBe("Bearer t");
  });

  it("passes the route id rather than the body into the action", async () => {
    const { PATCH } = await import("./route");
    await PATCH(patch({ action: "visibility", holderVisibleToOwner: false, holderVisibleToOthers: true }), context("g9"));

    expect(updateMyReservation).toHaveBeenCalledWith(expect.any(Headers), "g9", {
      action: "visibility",
      holderVisibleToOwner: false,
      holderVisibleToOthers: true,
    });
  });

  it("rejects a body that is not JSON without calling the action", async () => {
    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://x/api/v1/me/reservations/g1", {
        method: "PATCH",
        headers: { "content-type": "text/plain" },
        body: "bought",
      }),
      context(),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(updateMyReservation).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON without calling the action", async () => {
    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://x/api/v1/me/reservations/g1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: "{",
      }),
      context(),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(updateMyReservation).not.toHaveBeenCalled();
  });

  it.each([
    ["UNAUTHENTICATED", 401, { ok: false, code: "UNAUTHENTICATED", message: "Authentication required" }],
    ["NOT_FOUND", 404, { ok: false, code: "NOT_FOUND", message: "Gift not found" }],
    ["CONFLICT", 409, { ok: false, code: "CONFLICT", message: "The reservation cannot be changed" }],
    [
      "DUE_OUT_OF_RANGE",
      400,
      {
        ok: false,
        code: "VALIDATION",
        message: "Due date out of range",
        reason: "DUE_OUT_OF_RANGE",
        params: { max: "20.12.2026" },
      },
    ],
  ] as const)("maps %s to the AD-12 envelope", async (_case, status, refusal) => {
    updateMyReservation.mockResolvedValue(refusal);
    const { PATCH } = await import("./route");
    const response = await PATCH(patch({ action: "bought", value: true }), context());

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual(refusal);
  });

  it.each(["GET", "POST", "PUT", "DELETE"] as const)(
    "%s is the NOT_FOUND envelope, not an action",
    async (method) => {
      const handlers = await import("./route");
      const response = await handlers[method](
        new Request("http://x/api/v1/me/reservations/g1", { method }),
      );

      expect(response.status).toBe(404);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(await response.json()).toEqual(notFound);
      expect(updateMyReservation).not.toHaveBeenCalled();
    },
  );
});
