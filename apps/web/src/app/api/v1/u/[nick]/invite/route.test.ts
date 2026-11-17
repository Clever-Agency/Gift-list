import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { sendInviteByNick, cancelInviteByNick } = vi.hoisted(() => ({
  sendInviteByNick: vi.fn(),
  cancelInviteByNick: vi.fn(),
}));

vi.mock("@/actions/friend-invite", () => ({ sendInviteByNick, cancelInviteByNick }));

const envelope = { ok: false, code: "NOT_FOUND", message: "Not found" };

async function callRoute(
  nick: string,
  { headers = {}, body }: { headers?: Record<string, string>; body?: string } = {},
) {
  const { POST } = await import("./route");
  const res = await POST(
    new Request(`http://x/api/v1/u/${encodeURIComponent(nick)}/invite`, {
      method: "POST",
      headers,
      ...(body === undefined ? {} : { body }),
    }),
    { params: Promise.resolve({ nick }) },
  );
  return { res, body: await res.json() };
}

beforeEach(() => {
  sendInviteByNick.mockReset();
  cancelInviteByNick.mockReset();
  sendInviteByNick.mockResolvedValue({ ok: true, data: { outcome: "INVITED" } });
  cancelInviteByNick.mockResolvedValue({ ok: true, data: { outcome: "CANCELLED" } });
});

describe("POST /api/v1/u/:nick/invite", () => {
  it("returns the closed outcome in the AD-12 envelope with a private cache header", async () => {
    const { res, body } = await callRoute("Anna", { headers: { authorization: "Bearer t" } });

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(body).toEqual({ ok: true, data: { outcome: "INVITED" } });
    expect(sendInviteByNick).toHaveBeenCalledTimes(1);
    const [nick, headers] = sendInviteByNick.mock.calls[0] as [string, Headers];
    expect(nick).toBe("Anna");
    expect(headers.get("authorization")).toBe("Bearer t");
  });

  it("ignores an arbitrary user id or token in the body: the path nick is the only target", async () => {
    await callRoute("Anna", {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ toUserId: "victim", userId: "u1", publicToken: "tok" }),
    });

    const [nick, headers] = sendInviteByNick.mock.calls[0] as [string, Headers];
    expect(nick).toBe("Anna");
    expect(headers).toBeInstanceOf(Headers);
    expect(sendInviteByNick).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{ ok: false, code: "UNAUTHENTICATED", message: "Authentication required" }, 401],
    [{ ok: false, code: "FORBIDDEN", message: "Forbidden" }, 403],
    [envelope, 404],
  ] as const)("maps a failure result to its AD-12 status", async (result, status) => {
    sendInviteByNick.mockResolvedValue(result);

    const { res, body } = await callRoute("anna");

    expect(res.status).toBe(status);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(body).toEqual(result);
  });

  it("never adds a name, email or token to a refusal", async () => {
    sendInviteByNick.mockResolvedValue(envelope);

    const { body } = await callRoute("anna");

    expect(JSON.stringify(body)).not.toContain("anna@example.com");
    expect(JSON.stringify(body)).not.toContain("publicToken");
  });

  it("keeps the AD-12 envelope for unsupported methods", async () => {
    const { GET, PUT, PATCH } = await import("./route");
    const request = new Request("http://x/api/v1/u/anna/invite");

    for (const handler of [GET, PUT, PATCH]) {
      const res = handler(request);
      expect(res.status).toBe(404);
      expect(res.headers.get("cache-control")).toBe("private, no-store");
      expect(await res.json()).toEqual(envelope);
    }
  });
});

describe("DELETE /api/v1/u/:nick/invite", () => {
  async function callDelete(nick: string, body?: string) {
    const { DELETE } = await import("./route");
    const res = await DELETE(
      new Request(`http://x/api/v1/u/${encodeURIComponent(nick)}/invite`, {
        method: "DELETE",
        headers: { "content-type": "application/json", authorization: "Bearer t" },
        ...(body === undefined ? {} : { body }),
      }),
      { params: Promise.resolve({ nick }) },
    );
    return { res, body: await res.json() };
  }

  it("is a real cancel now, not the old 404, and keeps the private cache header", async () => {
    const { res, body } = await callDelete("Anna");

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(body).toEqual({ ok: true, data: { outcome: "CANCELLED" } });
    const [nick, headers] = cancelInviteByNick.mock.calls[0] as [string, Headers];
    expect(nick).toBe("Anna");
    expect(headers.get("authorization")).toBe("Bearer t");
    expect(sendInviteByNick).not.toHaveBeenCalled();
  });

  it("ignores any body: the path nick is the only target", async () => {
    await callDelete("Anna", JSON.stringify({ toUserId: "victim", userId: "u1" }));

    const [nick] = cancelInviteByNick.mock.calls[0] as [string, Headers];
    expect(nick).toBe("Anna");
    expect(cancelInviteByNick).toHaveBeenCalledTimes(1);
  });

  it("returns ALREADY_FRIENDS as a successful no-op", async () => {
    cancelInviteByNick.mockResolvedValue({ ok: true, data: { outcome: "ALREADY_FRIENDS" } });

    const { res, body } = await callDelete("anna");

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, data: { outcome: "ALREADY_FRIENDS" } });
  });

  it.each([
    [{ ok: false, code: "UNAUTHENTICATED", message: "Authentication required" }, 401],
    [{ ok: false, code: "FORBIDDEN", message: "Forbidden" }, 403],
    [envelope, 404],
  ] as const)("maps a failure result to its AD-12 status", async (result, status) => {
    cancelInviteByNick.mockResolvedValue(result);

    const { res, body } = await callDelete("anna");

    expect(res.status).toBe(status);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(body).toEqual(result);
  });
});
