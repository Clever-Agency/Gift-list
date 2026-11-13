import { beforeEach, describe, expect, it, vi } from "vitest";

const { subscribeByNick, unsubscribeByNick } = vi.hoisted(() => ({
  subscribeByNick: vi.fn(),
  unsubscribeByNick: vi.fn(),
}));

vi.mock("@/actions/subscription", () => ({
  subscribeByNick,
  unsubscribeByNick,
  removeSubscriberByNick: vi.fn(),
}));

const forbidden = { ok: false as const, code: "FORBIDDEN" as const, message: "Forbidden" };
const notFound = { ok: false as const, code: "NOT_FOUND" as const, message: "Not found" };

async function callSubscribe(
  nick: string,
  { headers = {}, body }: { headers?: Record<string, string>; body?: string } = {},
) {
  const { POST } = await import("./route");
  const res = await POST(
    new Request(`http://x/api/v1/u/${encodeURIComponent(nick)}/subscription`, {
      method: "POST",
      headers,
      ...(body === undefined ? {} : { body }),
    }),
    { params: Promise.resolve({ nick }) },
  );
  return { res, body: await res.json() };
}

async function callUnsubscribe(nick: string, headers: Record<string, string> = {}) {
  const { DELETE } = await import("./route");
  const res = await DELETE(
    new Request(`http://x/api/v1/u/${encodeURIComponent(nick)}/subscription`, {
      method: "DELETE",
      headers,
    }),
    { params: Promise.resolve({ nick }) },
  );
  return { res, body: await res.json() };
}

beforeEach(() => {
  subscribeByNick.mockReset();
  unsubscribeByNick.mockReset();
  subscribeByNick.mockResolvedValue({ ok: true, data: { outcome: "SUBSCRIBED" } });
  unsubscribeByNick.mockResolvedValue({ ok: true, data: { outcome: "UNSUBSCRIBED" } });
});

describe("POST /api/v1/u/:nick/subscription (Story 4.6)", () => {
  it("returns the closed outcome in the AD-12 envelope with a private cache header", async () => {
    const { res, body } = await callSubscribe("Anna", { headers: { authorization: "Bearer t" } });

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(body).toEqual({ ok: true, data: { outcome: "SUBSCRIBED" } });
    expect(subscribeByNick).toHaveBeenCalledTimes(1);
    const [nick, headers] = subscribeByNick.mock.calls[0] as [string, Headers];
    expect(nick).toBe("Anna");
    expect(headers.get("authorization")).toBe("Bearer t");
  });

  it("ignores an arbitrary user id or token in the body: the path nick is the only target", async () => {
    await callSubscribe("Anna", {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ toUserId: "victim", userId: "u1", publicToken: "tok" }),
    });

    expect(subscribeByNick).toHaveBeenCalledTimes(1);
    expect(subscribeByNick.mock.calls[0]?.[0]).toBe("Anna");
  });

  it.each([
    [{ ok: false, code: "UNAUTHENTICATED", message: "Authentication required" }, 401],
    [forbidden, 403],
    [notFound, 404],
  ] as const)("maps a failure result to its AD-12 status", async (result, status) => {
    subscribeByNick.mockResolvedValue(result);

    const { res, body } = await callSubscribe("anna");

    expect(res.status).toBe(status);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(body).toEqual(result);
  });

  it("keeps the AD-12 envelope for unsupported methods", async () => {
    const { GET, PUT, PATCH } = await import("./route");
    const request = new Request("http://x/api/v1/u/anna/subscription");

    for (const handler of [GET, PUT, PATCH]) {
      const res = handler(request);
      expect(res.status).toBe(404);
      expect(res.headers.get("cache-control")).toBe("private, no-store");
      expect(await res.json()).toEqual(notFound);
    }
  });
});

describe("DELETE /api/v1/u/:nick/subscription (Story 4.6)", () => {
  it("removes the viewer's own subscription and returns the closed outcome", async () => {
    const { res, body } = await callUnsubscribe("Anna", { cookie: "sid=1" });

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(body).toEqual({ ok: true, data: { outcome: "UNSUBSCRIBED" } });
    const [nick, headers] = unsubscribeByNick.mock.calls[0] as [string, Headers];
    expect(nick).toBe("Anna");
    expect(headers.get("cookie")).toBe("sid=1");
  });

  it("passes a repeat through as a successful no-op", async () => {
    unsubscribeByNick.mockResolvedValue({ ok: true, data: { outcome: "NOT_SUBSCRIBED" } });

    const { res, body } = await callUnsubscribe("anna");

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, data: { outcome: "NOT_SUBSCRIBED" } });
  });

  it.each([
    [{ ok: false, code: "UNAUTHENTICATED", message: "Authentication required" }, 401],
    [forbidden, 403],
    [notFound, 404],
  ] as const)("maps a failure result to its AD-12 status", async (result, status) => {
    unsubscribeByNick.mockResolvedValue(result);

    const { res, body } = await callUnsubscribe("anna");

    expect(res.status).toBe(status);
    expect(body).toEqual(result);
  });
});
