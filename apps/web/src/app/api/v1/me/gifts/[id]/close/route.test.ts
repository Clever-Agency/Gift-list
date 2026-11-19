import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { closeGift } = vi.hoisted(() => ({ closeGift: vi.fn() }));

vi.mock("@/actions/gift-close", () => ({ closeGift }));

import { GET, POST } from "./route";

const closedCard = {
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
  status: "CLOSED" as const,
  reservedBy: null,
  reservationLabel: null,
  ownerAction: null,
  undoUntil: "2026-11-19T10:10:00.000Z",
};

const notFound = { ok: false, code: "NOT_FOUND", message: "Not found" };

const unauthenticated = {
  ok: false,
  code: "UNAUTHENTICATED",
  message: "Authentication required",
};

function post(headers: Record<string, string> = { authorization: "Bearer t" }) {
  return new Request("http://x/api/v1/me/gifts/g7/close", { method: "POST", headers });
}

/** Next 16 hands the dynamic segment over as a promise. */
function context(id = "g7") {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  closeGift.mockReset();
  closeGift.mockResolvedValue({ ok: true, data: closedCard });
});

describe("POST /api/v1/me/gifts/[id]/close", () => {
  it("returns 200 with the closed owner's card, undoUntil included", async () => {
    const res = await POST(post(), context());

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual({ ok: true, data: closedCard });
  });

  it("passes the route id and the request headers to closeGift", async () => {
    await POST(post({ authorization: "Bearer t" }), context("g9"));

    expect(closeGift).toHaveBeenCalledTimes(1);
    const [headers, id] = closeGift.mock.calls[0] as [Headers, string];
    expect(id).toBe("g9");
    expect(headers.get("authorization")).toBe("Bearer t");
  });

  it("answers UNAUTHENTICATED with 401", async () => {
    closeGift.mockResolvedValue(unauthenticated);

    const res = await POST(post({}), context());

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual(unauthenticated);
  });

  it("maps a foreign or unknown wish to 404 and never answers FORBIDDEN", async () => {
    closeGift.mockResolvedValue({ ok: false, code: "NOT_FOUND", message: "Gift not found" });

    const res = await POST(post(), context("g-foreign"));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ ok: false, code: "NOT_FOUND", message: "Gift not found" });
    expect(JSON.stringify(body)).not.toContain("FORBIDDEN");
  });

  it("maps an archived own wish to 400 with GIFT_ARCHIVED", async () => {
    closeGift.mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      reason: "GIFT_ARCHIVED",
    });

    const res = await POST(post(), context());

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      reason: "GIFT_ARCHIVED",
    });
  });

  it("maps an already closed wish to 409 CONFLICT without a reason", async () => {
    closeGift.mockResolvedValue({
      ok: false,
      code: "CONFLICT",
      message: "Gift is already closed",
    });

    const res = await POST(post(), context());
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body).toEqual({
      ok: false,
      code: "CONFLICT",
      message: "Gift is already closed",
    });
    expect(body).not.toHaveProperty("reason");
  });

  it.each(["GET", "PUT", "PATCH", "DELETE"] as const)(
    "%s is the NOT_FOUND envelope, not a write",
    async (method) => {
      const handlers = await import("./route");
      const res = await handlers[method](
        new Request("http://x/api/v1/me/gifts/g7/close", { method }),
      );

      expect(res.status).toBe(404);
      expect(res.headers.get("cache-control")).toBe("private, no-store");
      expect(await res.json()).toEqual(notFound);
      expect(closeGift).not.toHaveBeenCalled();
    },
  );

  it("answers GET as not found and does not call the action", async () => {
    const res = GET(new Request("http://x/api/v1/me/gifts/g7/close"));

    expect(res.status).toBe(404);
    expect(closeGift).not.toHaveBeenCalled();
  });
});
