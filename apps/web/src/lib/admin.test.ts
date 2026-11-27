// CLE-143 (Story 10.1, AD-22): the server gate of `/admin` — anonymous, USER and
// ADMIN, and a role that must come from the database.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, findUnique } = vi.hoisted(() => ({
  getSession: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));

vi.mock("@/db/client", () => ({ prisma: { user: { findUnique } } }));

vi.mock("next/headers", () => ({
  headers: vi.fn(async function requestHeaders() {
    const headers = new Headers();
    headers.set("x-test", "page");
    return headers;
  }),
}));

import { requireAdmin } from "./admin";

beforeEach(() => {
  getSession.mockReset();
  findUnique.mockReset();
  getSession.mockResolvedValue(null);
  findUnique.mockResolvedValue(null);
});

describe("requireAdmin (Story 10.1, AD-22)", () => {
  it("refuses an anonymous visitor before the database", async () => {
    await expect(requireAdmin()).resolves.toEqual({ ok: false });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("refuses a USER", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } });
    findUnique.mockResolvedValue({ role: "USER" });

    await expect(requireAdmin()).resolves.toEqual({ ok: false });
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "u1" },
      select: { role: true },
    });
  });

  it("refuses a session whose account no longer exists", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } });
    findUnique.mockResolvedValue(null);

    await expect(requireAdmin()).resolves.toEqual({ ok: false });
  });

  it("admits an ADMIN and returns the account id", async () => {
    getSession.mockResolvedValue({ user: { id: "admin1" } });
    findUnique.mockResolvedValue({ role: "ADMIN" });

    await expect(requireAdmin()).resolves.toEqual({ ok: true, userId: "admin1" });
  });

  it("uses the request headers of a page by default", async () => {
    getSession.mockResolvedValue({ user: { id: "admin1" } });
    findUnique.mockResolvedValue({ role: "ADMIN" });

    await requireAdmin();

    const passed = getSession.mock.calls[0]?.[0] as { headers: Headers };
    expect(passed.headers.get("x-test")).toBe("page");
  });

  it("passes explicit headers of an action or a route handler", async () => {
    getSession.mockResolvedValue(null);
    const own = new Headers({ "x-test": "action" });

    await requireAdmin(own);

    expect(getSession).toHaveBeenCalledWith({ headers: own });
  });
});
