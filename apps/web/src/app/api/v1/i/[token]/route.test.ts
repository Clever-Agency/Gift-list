import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getInvitePreview } = vi.hoisted(() => ({ getInvitePreview: vi.fn() }));

vi.mock("@/actions/invite-link", () => ({ getInvitePreview }));

const envelope = { ok: false, code: "NOT_FOUND", message: "Not found" };

async function call(token: string) {
  const { GET } = await import("./route");
  const res = await GET(
    new Request(`http://x/api/v1/i/${encodeURIComponent(token)}`, {
      headers: { authorization: "Bearer t" },
    }),
    { params: Promise.resolve({ token }) },
  );
  return { res, body: await res.json() };
}

beforeEach(() => {
  getInvitePreview.mockReset();
  getInvitePreview.mockResolvedValue({
    ok: true,
    data: { inviter: { displayName: "Анна", nick: "anna" }, state: "can_accept" },
  });
});

describe("GET /api/v1/i/:token", () => {
  it("returns the preview in the AD-12 envelope with a private cache header", async () => {
    const { res, body } = await call("cu2token");

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(body).toEqual({
      ok: true,
      data: { inviter: { displayName: "Анна", nick: "anna" }, state: "can_accept" },
    });
    const [token, headers] = getInvitePreview.mock.calls[0] as [string, Headers];
    expect(token).toBe("cu2token");
    expect(headers.get("authorization")).toBe("Bearer t");
  });

  it("maps not found to a 404 with one body for an unknown token and a block", async () => {
    getInvitePreview.mockResolvedValue(envelope);

    const first = await call("cu2token");
    const second = await call("blocked");

    expect(first.res.status).toBe(404);
    expect(second.res.status).toBe(404);
    expect(first.body).toEqual(envelope);
    expect(second.body).toEqual(envelope);
  });

  it("keeps unsupported methods out of the action", async () => {
    const { POST, PUT, PATCH, DELETE, HEAD } = await import("./route");

    for (const handler of [POST, PUT, PATCH, DELETE, HEAD]) {
      const res = await handler(new Request("http://x/api/v1/i/cu2token"));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual(envelope);
    }
    expect(getInvitePreview).not.toHaveBeenCalled();
  });
});
