import { giftReservationWarningSchema } from "@gift-list/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { previewReservationRelease, releaseReservationAsOwner } = vi.hoisted(() => ({
  previewReservationRelease: vi.fn(),
  releaseReservationAsOwner: vi.fn(),
}));

vi.mock("@/actions/gift-release", () => ({ previewReservationRelease, releaseReservationAsOwner }));

const notFound = { ok: false, code: "NOT_FOUND", message: "Not found" };

function get(headers: Record<string, string> = {}) {
  return new Request("http://x/api/v1/me/gifts/g7/reservation", { method: "GET", headers });
}

function remove(headers: Record<string, string> = {}) {
  return new Request("http://x/api/v1/me/gifts/g7/reservation", { method: "DELETE", headers });
}

/** Next 16 hands the dynamic segment over as a promise. */
function context(id = "g7") {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  previewReservationRelease.mockReset();
  previewReservationRelease.mockResolvedValue({ ok: true, data: { warning: null } });
  releaseReservationAsOwner.mockReset();
  releaseReservationAsOwner.mockResolvedValue({ ok: true, data: { id: "g7" } });
});

describe("GET /api/v1/me/gifts/[id]/reservation", () => {
  it("answers warning BOUGHT in the AD-12 envelope", async () => {
    previewReservationRelease.mockResolvedValue({ ok: true, data: { warning: "BOUGHT" } });
    const { GET } = await import("./route");
    const res = await GET(get({ authorization: "Bearer t" }), context());

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual({ ok: true, data: { warning: "BOUGHT" } });
  });

  it("answers warning null when nothing is bought or nothing is reserved", async () => {
    const { GET } = await import("./route");
    const res = await GET(get(), context());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, data: { warning: null } });
  });

  it.each(["BOUGHT", null] as const)(
    "carries no holder, due date, phase or bought for warning %j",
    async (warning) => {
      previewReservationRelease.mockResolvedValue({ ok: true, data: { warning } });
      const { GET } = await import("./route");
      const body = (await (await GET(get(), context())).json()) as {
        ok: true;
        data: Record<string, unknown>;
      };

      expect(body.data).toEqual({ warning });
      expect(body.data).not.toHaveProperty("reservedBy");
      expect(body.data).not.toHaveProperty("reservedByNick");
      expect(body.data).not.toHaveProperty("dueOn");
      expect(body.data).not.toHaveProperty("reservationPhase");
      expect(body.data).not.toHaveProperty("reservationBought");
      expect(body.data).not.toHaveProperty("bought");
      expect(giftReservationWarningSchema.safeParse(body.data).success).toBe(true);
    },
  );

  it("passes the route id and the request headers to the preflight", async () => {
    const { GET } = await import("./route");
    await GET(get({ authorization: "Bearer t" }), context("g9"));

    expect(previewReservationRelease).toHaveBeenCalledWith(expect.any(Headers), "g9");
    const headers = previewReservationRelease.mock.calls[0][0] as Headers;
    expect(headers.get("authorization")).toBe("Bearer t");
  });

  it("answers UNAUTHENTICATED with 401", async () => {
    previewReservationRelease.mockResolvedValue({
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

  it.each([
    ["a foreign wish", "g-foreign"],
    ["an unknown wish", "g-unknown"],
  ])("maps %s to the same 404 body", async (_case, id) => {
    previewReservationRelease.mockResolvedValue({
      ok: false,
      code: "NOT_FOUND",
      message: "Gift not found",
    });
    const { GET } = await import("./route");
    const res = await GET(get(), context(id));

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Gift not found",
    });
  });

  it("writes nothing: the preflight is a read", async () => {
    const { GET } = await import("./route");
    await GET(get(), context());

    expect(releaseReservationAsOwner).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/v1/me/gifts/[id]/reservation", () => {
  it("answers 200 with the released id in the AD-12 envelope", async () => {
    releaseReservationAsOwner.mockResolvedValue({ ok: true, data: { id: "g7" } });
    const { DELETE } = await import("./route");
    const res = await DELETE(remove({ authorization: "Bearer t" }), context());

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual({ ok: true, data: { id: "g7" } });
  });

  it("passes the route id and the request headers to the owner release", async () => {
    releaseReservationAsOwner.mockResolvedValue({ ok: true, data: { id: "g9" } });
    const { DELETE } = await import("./route");
    await DELETE(remove({ authorization: "Bearer t" }), context("g9"));

    expect(releaseReservationAsOwner).toHaveBeenCalledWith(expect.any(Headers), "g9");
    const headers = releaseReservationAsOwner.mock.calls[0][0] as Headers;
    expect(headers.get("authorization")).toBe("Bearer t");
  });

  it("ignores a body on the release", async () => {
    const { DELETE } = await import("./route");
    const res = await DELETE(
      new Request("http://x/api/v1/me/gifts/g7/reservation", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "OPEN" }),
      }),
      context(),
    );

    expect(res.status).toBe(200);
    expect(releaseReservationAsOwner).toHaveBeenCalledWith(expect.any(Headers), "g7");
  });

  it("answers UNAUTHENTICATED with 401", async () => {
    releaseReservationAsOwner.mockResolvedValue({
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
    ["a foreign wish", "g-foreign"],
    ["an unknown wish", "g-unknown"],
    ["a wish that is no longer reserved", "g-open"],
  ])("maps %s to the same 404 body", async (_case, id) => {
    releaseReservationAsOwner.mockResolvedValue({
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
    releaseReservationAsOwner.mockResolvedValue({
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
});

describe("other methods", () => {
  it.each(["POST", "PUT", "PATCH"] as const)(
    "%s is the NOT_FOUND envelope, not a read or a write",
    async (method) => {
      const handlers = await import("./route");
      const res = await handlers[method](
        new Request("http://x/api/v1/me/gifts/g7/reservation", { method }),
      );

      expect(res.status).toBe(404);
      expect(res.headers.get("cache-control")).toBe("private, no-store");
      expect(await res.json()).toEqual(notFound);
      expect(previewReservationRelease).not.toHaveBeenCalled();
      expect(releaseReservationAsOwner).not.toHaveBeenCalled();
    },
  );
});
