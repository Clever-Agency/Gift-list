import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getMyInviteLink } = vi.hoisted(() => ({ getMyInviteLink: vi.fn() }));

vi.mock("@/actions/invite-link", () => ({ getMyInviteLink }));

const envelope = { ok: false, code: "NOT_FOUND", message: "Not found" };

async function call() {
  const { GET } = await import("./route");
  const res = await GET(
    new Request("http://x/api/v1/me/invite-link", {
      headers: { authorization: "Bearer t" },
    }),
  );
  return { res, body: await res.json() };
}

beforeEach(() => {
  getMyInviteLink.mockReset();
  getMyInviteLink.mockResolvedValue({ ok: true, data: { token: "cu2token" } });
});

describe("GET /api/v1/me/invite-link", () => {
  it("returns the token in the AD-12 envelope with a private cache header", async () => {
    const { res, body } = await call();

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(body).toEqual({ ok: true, data: { token: "cu2token" } });
    const [headers] = getMyInviteLink.mock.calls[0] as [Headers];
    expect(headers.get("authorization")).toBe("Bearer t");
  });

  it("maps the 401 refusal to its AD-12 status", async () => {
    getMyInviteLink.mockResolvedValue({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });

    const { res, body } = await call();

    expect(res.status).toBe(401);
    expect(body).toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
  });

  it("keeps unsupported methods out of the action", async () => {
    const { POST, PUT, PATCH, DELETE, HEAD } = await import("./route");

    for (const handler of [POST, PUT, PATCH, DELETE, HEAD]) {
      const res = await handler(new Request("http://x/api/v1/me/invite-link"));
      expect(res.status).toBe(404);
      expect(res.headers.get("cache-control")).toBe("private, no-store");
      expect(await res.json()).toEqual(envelope);
    }
    expect(getMyInviteLink).not.toHaveBeenCalled();
  });
});
