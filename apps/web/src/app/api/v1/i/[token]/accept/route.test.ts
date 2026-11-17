import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { acceptInviteByToken } = vi.hoisted(() => ({ acceptInviteByToken: vi.fn() }));

vi.mock("@/actions/invite-link", () => ({ acceptInviteByToken }));

const envelope = { ok: false, code: "NOT_FOUND", message: "Not found" };

async function call(token: string, body?: string) {
  const { POST } = await import("./route");
  const res = await POST(
    new Request(`http://x/api/v1/i/${encodeURIComponent(token)}/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      ...(body === undefined ? {} : { body }),
    }),
    { params: Promise.resolve({ token }) },
  );
  return { res, body: await res.json() };
}

beforeEach(() => {
  acceptInviteByToken.mockReset();
  acceptInviteByToken.mockResolvedValue({ ok: true, data: { outcome: "FRIENDS" } });
});

describe("POST /api/v1/i/:token/accept", () => {
  it("returns the closed outcome with a private cache header", async () => {
    const { res, body } = await call("cu2token");

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(body).toEqual({ ok: true, data: { outcome: "FRIENDS" } });
    const [token] = acceptInviteByToken.mock.calls[0] as [string, Headers];
    expect(token).toBe("cu2token");
  });

  it("does not read the body: the path token is the only input", async () => {
    await call("cu2token", JSON.stringify({ token: "other", userId: "victim" }));

    expect(acceptInviteByToken).toHaveBeenCalledTimes(1);
    expect(acceptInviteByToken.mock.calls[0]?.[0]).toBe("cu2token");
  });

  it("keeps ALREADY_FRIENDS a successful no-op", async () => {
    acceptInviteByToken.mockResolvedValue({ ok: true, data: { outcome: "ALREADY_FRIENDS" } });

    const { res, body } = await call("cu2token");

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, data: { outcome: "ALREADY_FRIENDS" } });
  });

  it.each([
    [{ ok: false, code: "UNAUTHENTICATED", message: "Authentication required" }, 401],
    [{ ok: false, code: "FORBIDDEN", message: "Forbidden" }, 403],
    [envelope, 404],
  ] as const)("maps a failure result to its AD-12 status", async (result, status) => {
    acceptInviteByToken.mockResolvedValue(result);

    const { res, body } = await call("cu2token");

    expect(res.status).toBe(status);
    expect(body).toEqual(result);
  });

  it("keeps unsupported methods out of the action", async () => {
    const { GET, PUT, PATCH, DELETE, HEAD } = await import("./route");

    for (const handler of [GET, PUT, PATCH, DELETE, HEAD]) {
      const res = await handler(new Request("http://x/api/v1/i/cu2token/accept"));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual(envelope);
    }
    expect(acceptInviteByToken).not.toHaveBeenCalled();
  });
});
