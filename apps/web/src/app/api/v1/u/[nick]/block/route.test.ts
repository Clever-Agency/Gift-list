import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { blockUserByNick, unblockUserByNick } = vi.hoisted(() => ({
  blockUserByNick: vi.fn(),
  unblockUserByNick: vi.fn(),
}));

vi.mock("@/actions/block", () => ({ blockUserByNick, unblockUserByNick }));

const envelope = { ok: false, code: "NOT_FOUND", message: "Not found" };

async function call(method: "POST" | "DELETE", nick: string, body?: string) {
  const route = await import("./route");
  const handler = method === "POST" ? route.POST : route.DELETE;
  const res = await handler(
    new Request(`http://x/api/v1/u/${encodeURIComponent(nick)}/block`, {
      method,
      headers: { "content-type": "application/json", authorization: "Bearer t" },
      ...(body === undefined ? {} : { body }),
    }),
    { params: Promise.resolve({ nick }) },
  );
  return { res, body: await res.json() };
}

beforeEach(() => {
  blockUserByNick.mockReset();
  unblockUserByNick.mockReset();
  blockUserByNick.mockResolvedValue({ ok: true, data: { outcome: "BLOCKED" } });
  unblockUserByNick.mockResolvedValue({ ok: true, data: { outcome: "UNBLOCKED" } });
});

describe("POST /api/v1/u/:nick/block", () => {
  it("returns the closed outcome in the AD-12 envelope with a private cache header", async () => {
    const { res, body } = await call("POST", "Anna");

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(body).toEqual({ ok: true, data: { outcome: "BLOCKED" } });
    expect(blockUserByNick).toHaveBeenCalledTimes(1);
    const [nick, headers] = blockUserByNick.mock.calls[0] as [string, Headers];
    expect(nick).toBe("Anna");
    expect(headers.get("authorization")).toBe("Bearer t");
  });

  it("ignores any body: the path nick is the only target", async () => {
    await call("POST", "Anna", JSON.stringify({ otherUserId: "victim", userId: "u1" }));

    const [nick] = blockUserByNick.mock.calls[0] as [string, Headers];
    expect(nick).toBe("Anna");
    expect(blockUserByNick).toHaveBeenCalledTimes(1);
  });

  it("returns ALREADY_BLOCKED as a successful no-op, not an error", async () => {
    blockUserByNick.mockResolvedValue({ ok: true, data: { outcome: "ALREADY_BLOCKED" } });

    const { res, body } = await call("POST", "anna");

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, data: { outcome: "ALREADY_BLOCKED" } });
  });

  it.each([
    [{ ok: false, code: "UNAUTHENTICATED", message: "Authentication required" }, 401],
    [{ ok: false, code: "FORBIDDEN", message: "Forbidden" }, 403],
    [envelope, 404],
  ] as const)("maps a failure result to its AD-12 status", async (result, status) => {
    blockUserByNick.mockResolvedValue(result);

    const { res, body } = await call("POST", "anna");

    expect(res.status).toBe(status);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(body).toEqual(result);
  });
});

describe("DELETE /api/v1/u/:nick/block", () => {
  it("returns the closed unblock outcome with a private cache header", async () => {
    const { res, body } = await call("DELETE", "Anna");

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(body).toEqual({ ok: true, data: { outcome: "UNBLOCKED" } });
    const [nick] = unblockUserByNick.mock.calls[0] as [string, Headers];
    expect(nick).toBe("Anna");
  });

  it("ignores any body and keeps NOT_BLOCKED a success", async () => {
    unblockUserByNick.mockResolvedValue({ ok: true, data: { outcome: "NOT_BLOCKED" } });

    const { res, body } = await call("DELETE", "anna", JSON.stringify({ otherUserId: "victim" }));

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, data: { outcome: "NOT_BLOCKED" } });
    expect(JSON.stringify(body)).not.toContain("victim");
  });

  it.each([
    [{ ok: false, code: "UNAUTHENTICATED", message: "Authentication required" }, 401],
    [{ ok: false, code: "FORBIDDEN", message: "Forbidden" }, 403],
    [envelope, 404],
  ] as const)("maps a failure result to its AD-12 status", async (result, status) => {
    unblockUserByNick.mockResolvedValue(result);

    const { res, body } = await call("DELETE", "anna");

    expect(res.status).toBe(status);
    expect(body).toEqual(result);
  });
});

describe("unsupported methods", () => {
  it("keep the AD-12 envelope and never reach an action", async () => {
    const { GET, PUT, PATCH } = await import("./route");
    const request = new Request("http://x/api/v1/u/anna/block");

    for (const handler of [GET, PUT, PATCH]) {
      const res = handler(request);
      expect(res.status).toBe(404);
      expect(res.headers.get("cache-control")).toBe("private, no-store");
      expect(await res.json()).toEqual(envelope);
    }
    expect(blockUserByNick).not.toHaveBeenCalled();
    expect(unblockUserByNick).not.toHaveBeenCalled();
  });
});
