import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, findUnique, update } = vi.hoisted(() => ({
  getSession: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({ prisma: { user: { findUnique, update } } }));

import { GET, PATCH, POST } from "./route";

const user = {
  id: "u1",
  email: "a@example.com",
  name: "Анна",
  nick: "anna",
  timeZone: null as string | null,
  hideFromSearch: false,
};

function patch(body: unknown) {
  return new Request("http://x/api/v1/me/hide-from-search", {
    method: "PATCH",
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

describe("PATCH /api/v1/me/hide-from-search", () => {
  it("changes the flag and answers the updated user in the AD-12 envelope", async () => {
    const res = await PATCH(patch({ hideFromSearch: true }));

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual({
      ok: true,
      data: {
        id: "u1",
        email: "a@example.com",
        name: "Анна",
        nick: "anna",
        timeZone: null,
        hideFromSearch: true,
      },
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { hideFromSearch: true },
    });
  });

  it("answers 401 without a session", async () => {
    getSession.mockResolvedValue(null);

    const res = await PATCH(patch({ hideFromSearch: true }));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it.each([["true"], [1], [null]])(
    "answers 400 VALIDATION on the hideFromSearch field for %j",
    async (value) => {
      const res = await PATCH(patch({ hideFromSearch: value }));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        ok: false,
        code: "VALIDATION",
        message: "Invalid input",
        field: "hideFromSearch",
      });
      expect(getSession).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    },
  );

  it("rejects a body with an extra key on the same field", async () => {
    const res = await PATCH(patch({ hideFromSearch: true, nick: "anna" }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: "hideFromSearch",
    });
    expect(getSession).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("answers 400 for broken JSON without calling the use-case", async () => {
    const res = await PATCH(
      new Request("http://x/api/v1/me/hide-from-search", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: "{not json",
      }),
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
    });
    expect(getSession).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("answers a NOT_FOUND envelope for GET and POST", async () => {
    for (const [handler, method] of [
      [GET, "GET"],
      [POST, "POST"],
    ] as const) {
      const res = await handler(new Request("http://x/api/v1/me/hide-from-search", { method }));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ ok: false, code: "NOT_FOUND", message: "Not found" });
    }
  });
});
