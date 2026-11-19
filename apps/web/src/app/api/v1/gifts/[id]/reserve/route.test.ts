import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { reserveGift, releaseMyReservation } = vi.hoisted(() => ({
  reserveGift: vi.fn(),
  releaseMyReservation: vi.fn(),
}));

vi.mock("@/actions/gift-reserve", () => ({ reserveGift }));
vi.mock("@/actions/gift-release", () => ({ releaseMyReservation }));

const notFound = { ok: false, code: "NOT_FOUND", message: "Not found" };

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://x/api/v1/gifts/g1/reserve?listToken=list_token", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function remove(headers: Record<string, string> = {}) {
  return new Request("http://x/api/v1/gifts/g1/reserve", { method: "DELETE", headers });
}

/** Next 16 hands the dynamic segment over as a promise. */
function context(id = "g1") {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  reserveGift.mockReset();
  reserveGift.mockResolvedValue({ ok: true, data: { id: "g1" } });
  releaseMyReservation.mockReset();
  releaseMyReservation.mockResolvedValue({ ok: true, data: { id: "g1" } });
});

describe("POST /api/v1/gifts/[id]/reserve", () => {
  it("passes the list token and the parsed body into the action", async () => {
    const { POST } = await import("./route");
    const body = {
      dueOn: "2026-12-01",
      holderVisibleToOwner: true,
      holderVisibleToOthers: false,
    };
    const response = await POST(post(body), context());

    expect(response.status).toBe(200);
    expect(reserveGift).toHaveBeenCalledWith(expect.any(Headers), "g1", body, "list_token");
  });
});

describe("DELETE /api/v1/gifts/[id]/reserve", () => {
  it("answers 200 with the released id in the AD-12 envelope", async () => {
    const { DELETE } = await import("./route");
    const res = await DELETE(remove({ authorization: "Bearer t" }), context());

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual({ ok: true, data: { id: "g1" } });
  });

  it("passes the route id and the request headers to releaseMyReservation", async () => {
    releaseMyReservation.mockResolvedValue({ ok: true, data: { id: "g9" } });
    const { DELETE } = await import("./route");
    await DELETE(remove({ authorization: "Bearer t" }), context("g9"));

    expect(releaseMyReservation).toHaveBeenCalledWith(expect.any(Headers), "g9");
    const headers = releaseMyReservation.mock.calls[0][0] as Headers;
    expect(headers.get("authorization")).toBe("Bearer t");
  });

  it("never reserves: POST stays the reserve action", async () => {
    const { DELETE } = await import("./route");
    await DELETE(remove(), context());

    expect(reserveGift).not.toHaveBeenCalled();
  });

  it("ignores a body and a list token on the release", async () => {
    const { DELETE } = await import("./route");
    const res = await DELETE(
      new Request("http://x/api/v1/gifts/g1/reserve?listToken=list_token", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reservedById: "other", status: "OPEN" }),
      }),
      context(),
    );

    expect(res.status).toBe(200);
    expect(releaseMyReservation).toHaveBeenCalledWith(expect.any(Headers), "g1");
  });

  it("answers UNAUTHENTICATED with 401 without touching the reservation", async () => {
    releaseMyReservation.mockResolvedValue({
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

  it.each([
    ["a wish held by somebody else", "g-foreign"],
    ["an unknown wish", "g-unknown"],
    ["an already released reservation", "g-released"],
  ])("maps %s to the same 404 body", async (_case, id) => {
    releaseMyReservation.mockResolvedValue({
      ok: false,
      code: "NOT_FOUND",
      message: "Gift not found",
    });
    const { DELETE } = await import("./route");
    const res = await DELETE(remove(), context(id));

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Gift not found",
    });
  });

  it("maps a lost CAS to 409 CONFLICT", async () => {
    releaseMyReservation.mockResolvedValue({
      ok: false,
      code: "CONFLICT",
      message: "The reservation is already gone",
    });
    const { DELETE } = await import("./route");
    const res = await DELETE(remove(), context());

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      ok: false,
      code: "CONFLICT",
      message: "The reservation is already gone",
    });
  });

  it.each(["GET", "PUT", "PATCH"] as const)(
    "%s is the NOT_FOUND envelope, not a release",
    async (method) => {
      const handlers = await import("./route");
      const res = await handlers[method](new Request("http://x/api/v1/gifts/g1/reserve", { method }));

      expect(res.status).toBe(404);
      expect(res.headers.get("cache-control")).toBe("private, no-store");
      expect(await res.json()).toEqual(notFound);
      expect(releaseMyReservation).not.toHaveBeenCalled();
      expect(reserveGift).not.toHaveBeenCalled();
    },
  );
});
