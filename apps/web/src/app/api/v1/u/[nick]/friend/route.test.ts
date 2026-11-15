import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { removeFriendByNick } = vi.hoisted(() => ({ removeFriendByNick: vi.fn() }));

vi.mock("@/actions/friend-remove", () => ({ removeFriendByNick }));

const envelope = { ok: false, code: "NOT_FOUND", message: "Not found" };

async function callDelete(nick: string, body?: string) {
  const { DELETE } = await import("./route");
  const res = await DELETE(
    new Request(`http://x/api/v1/u/${encodeURIComponent(nick)}/friend`, {
      method: "DELETE",
      headers: { "content-type": "application/json", authorization: "Bearer t" },
      ...(body === undefined ? {} : { body }),
    }),
    { params: Promise.resolve({ nick }) },
  );
  return { res, body: await res.json() };
}

beforeEach(() => {
  removeFriendByNick.mockReset();
  removeFriendByNick.mockResolvedValue({ ok: true, data: { outcome: "REMOVED" } });
});

describe("DELETE /api/v1/u/:nick/friend", () => {
  it("returns the closed outcome in the AD-12 envelope with a private cache header", async () => {
    const { res, body } = await callDelete("Anna");

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(body).toEqual({ ok: true, data: { outcome: "REMOVED" } });
    expect(removeFriendByNick).toHaveBeenCalledTimes(1);
    const [nick, headers] = removeFriendByNick.mock.calls[0] as [string, Headers];
    expect(nick).toBe("Anna");
    expect(headers.get("authorization")).toBe("Bearer t");
  });

  it("ignores any body: the path nick is the only target", async () => {
    await callDelete("Anna", JSON.stringify({ otherUserId: "victim", userId: "u1" }));

    const [nick] = removeFriendByNick.mock.calls[0] as [string, Headers];
    expect(nick).toBe("Anna");
    expect(removeFriendByNick).toHaveBeenCalledTimes(1);
  });

  it("returns ALREADY_REMOVED as a successful no-op, not an error", async () => {
    removeFriendByNick.mockResolvedValue({ ok: true, data: { outcome: "ALREADY_REMOVED" } });

    const { res, body } = await callDelete("anna");

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, data: { outcome: "ALREADY_REMOVED" } });
  });

  it.each([
    [{ ok: false, code: "UNAUTHENTICATED", message: "Authentication required" }, 401],
    [{ ok: false, code: "FORBIDDEN", message: "Forbidden" }, 403],
    [envelope, 404],
  ] as const)("maps a failure result to its AD-12 status", async (result, status) => {
    removeFriendByNick.mockResolvedValue(result);

    const { res, body } = await callDelete("anna");

    expect(res.status).toBe(status);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(body).toEqual(result);
  });

  it("never adds a name, email or token to a refusal", async () => {
    removeFriendByNick.mockResolvedValue(envelope);

    const { body } = await callDelete("anna");

    expect(JSON.stringify(body)).not.toContain("anna@example.com");
    expect(JSON.stringify(body)).not.toContain("publicToken");
  });

  it("keeps the AD-12 envelope for unsupported methods", async () => {
    const { GET, POST, PUT, PATCH } = await import("./route");
    const request = new Request("http://x/api/v1/u/anna/friend");

    for (const handler of [GET, POST, PUT, PATCH]) {
      const res = handler(request);
      expect(res.status).toBe(404);
      expect(res.headers.get("cache-control")).toBe("private, no-store");
      expect(await res.json()).toEqual(envelope);
    }
    expect(removeFriendByNick).not.toHaveBeenCalled();
  });
});
