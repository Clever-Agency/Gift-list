import { beforeEach, describe, expect, it, vi } from "vitest";

const { listMyDates, createMyDate } = vi.hoisted(() => ({
  listMyDates: vi.fn(),
  createMyDate: vi.fn(),
}));

vi.mock("@/actions/personal-dates", () => ({ listMyDates, createMyDate }));

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

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://x/api/v1/me/dates", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer t", ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  listMyDates.mockReset();
  createMyDate.mockReset();
  listMyDates.mockResolvedValue({ ok: true, data: [own] });
  createMyDate.mockResolvedValue({ ok: true, data: own });
});

describe("GET /api/v1/me/dates", () => {
  it("answers the owner's dates in the AD-12 envelope", async () => {
    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://x/api/v1/me/dates", { headers: { authorization: "Bearer t" } }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual({ ok: true, data: [own] });
    expect(listMyDates).toHaveBeenCalledWith(expect.any(Headers));
  });
});

describe("POST /api/v1/me/dates", () => {
  it("checks the body, applies the defaults and answers 201", async () => {
    const { POST } = await import("./route");
    const res = await POST(post({ title: "Годовщина", day: 14, month: 6, year: 2020 }));

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true, data: own });
    expect(createMyDate).toHaveBeenCalledWith(expect.any(Headers), {
      title: "Годовщина",
      day: 14,
      month: 6,
      year: 2020,
      visibility: "FRIENDS",
      yearVisibility: "ONLY_ME",
    });
  });

  it("answers 400 VALIDATION for 31 April before the use-case", async () => {
    const { POST } = await import("./route");
    const res = await POST(post({ title: "Ошибка", day: 31, month: 4 }));

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      ok: false,
      code: "VALIDATION",
      field: "day",
    });
    expect(createMyDate).not.toHaveBeenCalled();
  });

  it("answers 400 with the field for an unknown key", async () => {
    const { POST } = await import("./route");
    const res = await POST(post({ title: "Ошибка", day: 1, month: 1, ownerId: "u2" }));

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(createMyDate).not.toHaveBeenCalled();
  });

  it("keeps the other methods closed", async () => {
    const route = await import("./route");
    for (const [handler, method] of [
      [route.PUT, "PUT"],
      [route.PATCH, "PATCH"],
      [route.DELETE, "DELETE"],
    ] as const) {
      const res = await handler(new Request("http://x/api/v1/me/dates", { method }));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ ok: false, code: "NOT_FOUND", message: "Not found" });
    }
  });
});
