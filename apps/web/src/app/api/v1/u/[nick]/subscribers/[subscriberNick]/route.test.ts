import { beforeEach, describe, expect, it, vi } from "vitest";

const { removeSubscriberByNick } = vi.hoisted(() => ({ removeSubscriberByNick: vi.fn() }));

vi.mock("@/actions/subscription", () => ({
  removeSubscriberByNick,
  subscribeByNick: vi.fn(),
  unsubscribeByNick: vi.fn(),
}));

const forbidden = { ok: false as const, code: "FORBIDDEN" as const, message: "Forbidden" };
const notFound = { ok: false as const, code: "NOT_FOUND" as const, message: "Not found" };

async function callRemove(
  nick: string,
  subscriberNick: string,
  headers: Record<string, string> = {},
) {
  const { DELETE } = await import("./route");
  const res = await DELETE(
    new Request(
      `http://x/api/v1/u/${encodeURIComponent(nick)}/subscribers/${encodeURIComponent(subscriberNick)}`,
      { method: "DELETE", headers },
    ),
    { params: Promise.resolve({ nick, subscriberNick }) },
  );
  return { res, body: await res.json() };
}

beforeEach(() => {
  removeSubscriberByNick.mockReset();
  removeSubscriberByNick.mockResolvedValue({ ok: true, data: { outcome: "UNSUBSCRIBED" } });
});

describe("DELETE /api/v1/u/:nick/subscribers/:subscriberNick (Story 4.6)", () => {
  it("passes both path nicks to the use-case and returns the closed outcome", async () => {
    const { res, body } = await callRemove("Owner", "Anna", { authorization: "Bearer t" });

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(body).toEqual({ ok: true, data: { outcome: "UNSUBSCRIBED" } });
    const [nick, subscriberNick, headers] = removeSubscriberByNick.mock.calls[0] as [
      string,
      string,
      Headers,
    ];
    expect(nick).toBe("Owner");
    expect(subscriberNick).toBe("Anna");
    expect(headers.get("authorization")).toBe("Bearer t");
  });

  it("passes a repeat through as a successful no-op", async () => {
    removeSubscriberByNick.mockResolvedValue({ ok: true, data: { outcome: "NOT_SUBSCRIBED" } });

    const { res, body } = await callRemove("owner", "anna");

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, data: { outcome: "NOT_SUBSCRIBED" } });
  });

  it.each([
    [{ ok: false, code: "UNAUTHENTICATED", message: "Authentication required" }, 401],
    [forbidden, 403],
    [notFound, 404],
  ] as const)("maps a failure result to its AD-12 status", async (result, status) => {
    removeSubscriberByNick.mockResolvedValue(result);

    const { res, body } = await callRemove("owner", "anna");

    expect(res.status).toBe(status);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(body).toEqual(result);
  });

  it("never returns a subscriber list: the body is the closed outcome only", async () => {
    const { body } = await callRemove("owner", "anna");

    expect(Object.keys(body as object).sort()).toEqual(["data", "ok"]);
    expect(JSON.stringify(body)).not.toContain("subscribers");
  });

  it("keeps the AD-12 envelope for unsupported methods", async () => {
    const { GET, POST, PUT, PATCH } = await import("./route");
    const request = new Request("http://x/api/v1/u/owner/subscribers/anna");

    for (const handler of [GET, POST, PUT, PATCH]) {
      const res = handler(request);
      expect(res.status).toBe(404);
      expect(res.headers.get("cache-control")).toBe("private, no-store");
      expect(await res.json()).toEqual(notFound);
    }
  });
});
