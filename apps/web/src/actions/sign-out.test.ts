import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, signOut, deleteMany } = vi.hoisted(() => ({
  getSession: vi.fn(),
  signOut: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession, signOut } } }));
vi.mock("@/db/client", () => ({ prisma: { session: { deleteMany } } }));

import { signOutUser } from "./sign-out";

beforeEach(() => {
  getSession.mockReset();
  signOut.mockReset();
  deleteMany.mockReset();
  signOut.mockResolvedValue(new Response(null, { status: 200 }));
  deleteMany.mockResolvedValue({ count: 1 });
});

describe("signOutUser", () => {
  it("deletes only this client's session token", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" }, session: { token: "tok" } });
    const outcome = await signOutUser(new Headers({ authorization: "Bearer tok" }));
    expect(deleteMany).toHaveBeenCalledWith({ where: { token: "tok" } });
    expect(outcome.result).toEqual({ ok: true, data: { signedOut: true } });
    expect(signOut).toHaveBeenCalled();
  });

  it("succeeds when there is no session", async () => {
    getSession.mockResolvedValue(null);
    const outcome = await signOutUser(new Headers());
    expect(deleteMany).not.toHaveBeenCalled();
    expect(outcome.result.ok).toBe(true);
  });
});
