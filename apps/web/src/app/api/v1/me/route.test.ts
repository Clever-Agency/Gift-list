import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ cookie: "sid=1", authorization: "Bearer h" }),
}));

const user = { id: "u1", email: "a@example.com", name: "Анна", nick: "anna", hideFromSearch: false };

beforeEach(() => getSession.mockReset());

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
      data: { id: "u1", email: "a@example.com", name: "Анна", nick: "anna" },
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
