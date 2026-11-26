import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, findUnique, signOut, deleteAccount } = vi.hoisted(() => ({
  getSession: vi.fn(),
  findUnique: vi.fn(),
  signOut: vi.fn(),
  deleteAccount: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession, signOut } } }));
vi.mock("@/db/client", () => ({ prisma: { user: { findUnique } } }));
vi.mock("@/actions/delete-account", () => ({ deleteAccount }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ cookie: "sid=1", authorization: "Bearer h" }),
}));

const user = {
  id: "u1",
  email: "a@example.com",
  name: "Анна",
  nick: "anna",
  timeZone: null as string | null,
  hideFromSearch: false,
};

const expiredCookie = "better-auth.session_token=; Max-Age=0; Path=/; HttpOnly";

beforeEach(() => {
  getSession.mockReset();
  findUnique.mockReset();
  signOut.mockReset();
  deleteAccount.mockReset();
  findUnique.mockImplementation(async () => user);
  deleteAccount.mockResolvedValue("deleted");
  signOut.mockImplementation(
    async () =>
      new Response(null, {
        status: 200,
        headers: { "set-cookie": expiredCookie },
      }),
  );
});

async function both() {
  const { GET } = await import("./route");
  const { getMe } = await import("@/actions/me");
  const viaAction = await getMe();
  const res = await GET(new Request("http://x/api/v1/me"));
  return { viaAction, res, viaHttp: await res.json() };
}

describe("GET /api/v1/me", () => {
  it("returns the current user", async () => {
    getSession.mockResolvedValue({ user, session: {} });
    const { res, viaHttp } = await both();
    expect(res.status).toBe(200);
    expect(viaHttp).toEqual({
      ok: true,
      data: {
        id: "u1",
        email: "a@example.com",
        name: "Анна",
        nick: "anna",
        timeZone: null,
        hideFromSearch: false,
      },
    });
  });

  it("answers UNAUTHENTICATED without a session", async () => {
    getSession.mockResolvedValue(null);
    const { res, viaHttp } = await both();
    expect(res.status).toBe(401);
    expect(viaHttp).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
  });

  it("passes request headers to getSession", async () => {
    getSession.mockResolvedValue(null);
    const { GET } = await import("./route");
    await GET(
      new Request("http://x/api/v1/me", {
        headers: { authorization: "Bearer t", cookie: "a=b" },
      }),
    );
    const { headers } = getSession.mock.calls[0][0] as { headers: Headers };
    expect(headers.get("authorization")).toBe("Bearer t");
    expect(headers.get("cookie")).toBe("a=b");
  });

  it("getMe passes the request headers to getSession", async () => {
    getSession.mockResolvedValue(null);
    const { getMe } = await import("@/actions/me");
    await getMe();
    const { headers } = getSession.mock.calls[0][0] as { headers: Headers };
    expect(headers.get("cookie")).toBe("sid=1");
    expect(headers.get("authorization")).toBe("Bearer h");
  });

  it("matches the Server Action result", async () => {
    for (const session of [{ user, session: {} }, null]) {
      getSession.mockResolvedValue(session);
      const { viaAction, viaHttp } = await both();
      expect(viaHttp).toEqual(viaAction);
    }
  });
});

function deletion(body: unknown = { confirm: true }) {
  return new Request("http://x/api/v1/me", {
    method: "DELETE",
    headers: { "content-type": "application/json", cookie: "sid=1" },
    body: JSON.stringify(body),
  });
}

describe("DELETE /api/v1/me", () => {
  beforeEach(() => {
    getSession.mockResolvedValue({ user: { id: "u1" }, session: { token: "tok" } });
  });

  it("deletes the account, answers the envelope and expires the session cookie", async () => {
    const { DELETE } = await import("./route");

    const res = await DELETE(deletion());

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(await res.json()).toEqual({ ok: true, data: { deleted: true } });
    expect(deleteAccount).toHaveBeenCalledTimes(1);
    expect(deleteAccount).toHaveBeenCalledWith("u1");
    expect(signOut).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      asResponse: true,
    });
  });

  it("answers UNAUTHENTICATED before reading the body of an anonymous request", async () => {
    getSession.mockResolvedValue(null);
    const { DELETE } = await import("./route");

    const res = await DELETE(new Request("http://x/api/v1/me", { method: "DELETE" }));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
    expect(deleteAccount).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it.each([[{}], [{ confirm: false }], [{ confirm: "true" }], [{ confirm: 1 }], [{ yes: true }]])(
    "answers 400 VALIDATION on confirm for %j",
    async (body) => {
      const { DELETE } = await import("./route");

      const res = await DELETE(deletion(body));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        ok: false,
        code: "VALIDATION",
        message: "Invalid input",
        field: "confirm",
      });
      expect(deleteAccount).not.toHaveBeenCalled();
      expect(signOut).not.toHaveBeenCalled();
    },
  );

  it("answers 400 for a missing body without touching the account", async () => {
    const { DELETE } = await import("./route");

    const res = await DELETE(new Request("http://x/api/v1/me", { method: "DELETE" }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
    });
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it("treats a repeated call as success and still expires the cookie", async () => {
    deleteAccount.mockResolvedValue("already-deleted");
    const { DELETE } = await import("./route");

    const res = await DELETE(deletion());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, data: { deleted: true } });
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("answers 409 and keeps the cookie when the command is busy", async () => {
    deleteAccount.mockResolvedValue("busy");
    const { DELETE } = await import("./route");

    const res = await DELETE(deletion());

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      ok: false,
      code: "CONFLICT",
      message: "Account deletion is in progress, retry",
    });
    expect(signOut).not.toHaveBeenCalled();
  });

  it("keeps the other methods closed", async () => {
    const route = await import("./route");
    for (const [handler, method] of [
      [route.POST, "POST"],
      [route.PUT, "PUT"],
      [route.PATCH, "PATCH"],
    ] as const) {
      const res = await handler(new Request("http://x/api/v1/me", { method }));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        ok: false,
        code: "NOT_FOUND",
        message: "Not found",
      });
    }
  });
});
