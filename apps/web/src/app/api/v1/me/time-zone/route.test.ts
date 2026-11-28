import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, findUnique, update } = vi.hoisted(() => ({
  getSession: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({ prisma: { user: { findUnique, update } } }));

import { DELETE, GET, PATCH, POST, PUT } from "./route";

const user = { id: "u1", timeZone: "UTC" as string | null };

function request(method: "PUT" | "PATCH", body: unknown) {
  return new Request("http://x/api/v1/me/time-zone", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  getSession.mockReset();
  findUnique.mockReset();
  update.mockReset();
  getSession.mockResolvedValue({ user: { id: "u1" }, session: { token: "t" } });
  findUnique.mockResolvedValue(user);
  update.mockResolvedValue({});
});

describe("PUT /api/v1/me/time-zone", () => {
  it("keeps an already stored zone, as the device report never overwrites it", async () => {
    const res = await PUT(request("PUT", { timeZone: "Europe/Minsk" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, data: { timeZone: "UTC" } });
    expect(update).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/v1/me/time-zone", () => {
  it("overwrites the stored zone with the explicit choice", async () => {
    const res = await PATCH(request("PATCH", { timeZone: "Europe/Minsk" }));

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual({ ok: true, data: { timeZone: "Europe/Minsk" } });
    expect(update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { timeZone: "Europe/Minsk" },
    });
  });

  it.each([
    [{}],
    [{ timeZone: "" }],
    [{ timeZone: "Not/AZone" }],
  ])("answers 400 VALIDATION on timeZone for %j", async (body) => {
    const res = await PATCH(request("PATCH", body));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: "timeZone",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("answers 400 VALIDATION on a non-string zone before reading the session", async () => {
    const res = await PATCH(request("PATCH", { timeZone: 42 }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: "timeZone",
    });
    expect(getSession).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("answers 401 without a session", async () => {
    getSession.mockResolvedValue(null);

    const res = await PATCH(request("PATCH", { timeZone: "Europe/Minsk" }));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("answers a NOT_FOUND envelope for the other methods", async () => {
    for (const [handler, method] of [
      [GET, "GET"],
      [POST, "POST"],
      [DELETE, "DELETE"],
    ] as const) {
      const res = await handler(new Request("http://x/api/v1/me/time-zone", { method }));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ ok: false, code: "NOT_FOUND", message: "Not found" });
    }
  });
});
