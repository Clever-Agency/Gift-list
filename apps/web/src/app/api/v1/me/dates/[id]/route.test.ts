import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateMyDate, deleteMyDate } = vi.hoisted(() => ({
  updateMyDate: vi.fn(),
  deleteMyDate: vi.fn(),
}));

vi.mock("@/actions/personal-dates", () => ({ updateMyDate, deleteMyDate }));

const own = {
  id: "d1",
  kind: "CUSTOM",
  title: "Годовщина",
  day: 14,
  month: 6,
  year: 2020,
  visibility: "FRIENDS",
  yearVisibility: "ONLY_ME",
};

function patch(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://x/api/v1/me/dates/d1", {
    method: "PATCH",
    headers: { "content-type": "application/json", authorization: "Bearer t", ...headers },
    body: JSON.stringify(body),
  });
}

function remove(headers: Record<string, string> = {}) {
  return new Request("http://x/api/v1/me/dates/d1", {
    method: "DELETE",
    headers: { authorization: "Bearer t", ...headers },
  });
}

/** Next 16 hands the dynamic segment over as a promise. */
function context(id = "d1") {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  updateMyDate.mockReset();
  deleteMyDate.mockReset();
  updateMyDate.mockResolvedValue({ ok: true, data: own });
  deleteMyDate.mockResolvedValue({ ok: true, data: { id: "d1" } });
});

describe("PATCH /api/v1/me/dates/:id", () => {
  it("passes the id and the parsed body to the use-case", async () => {
    const { PATCH } = await import("./route");
    const res = await PATCH(patch({ title: "Новая", year: null }), context("d9"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, data: own });
    expect(updateMyDate).toHaveBeenCalledWith(expect.any(Headers), "d9", {
      title: "Новая",
      year: null,
    });
  });

  it("answers 400 for an empty body", async () => {
    const { PATCH } = await import("./route");
    const res = await PATCH(patch({}), context());

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(updateMyDate).not.toHaveBeenCalled();
  });

  it("answers 400 for a day without its month", async () => {
    const { PATCH } = await import("./route");
    const res = await PATCH(patch({ day: 15 }), context());

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      ok: false,
      code: "VALIDATION",
      field: "day",
    });
    expect(updateMyDate).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/v1/me/dates/:id", () => {
  it("passes the id and answers the deleted row", async () => {
    const { DELETE } = await import("./route");
    const res = await DELETE(remove(), context("d7"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, data: { id: "d1" } });
    expect(deleteMyDate).toHaveBeenCalledWith(expect.any(Headers), "d7");
  });

  it("keeps the read and the create closed", async () => {
    const route = await import("./route");
    for (const [handler, method] of [
      [route.GET, "GET"],
      [route.POST, "POST"],
      [route.PUT, "PUT"],
    ] as const) {
      const res = await handler(
        new Request("http://x/api/v1/me/dates/d1", { method }),
      );
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ ok: false, code: "NOT_FOUND", message: "Not found" });
    }
  });
});
