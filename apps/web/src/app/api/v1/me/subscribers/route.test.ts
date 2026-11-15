import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { listSubscribers } = vi.hoisted(() => ({ listSubscribers: vi.fn() }));

vi.mock("@/actions/circle", () => ({ listSubscribers }));

const page = {
  ok: true,
  data: {
    items: [
      {
        displayName: "Пётр",
        nick: "petr",
        relationship: "NONE",
        subscribed: false,
        followsYou: true,
      },
    ],
    nextCursor: null,
    total: 1,
  },
};

const unauthorised = {
  ok: false,
  code: "UNAUTHENTICATED",
  message: "Authentication required",
};

async function callRoute(query = "") {
  const { GET } = await import("./route");
  const res = await GET(
    new Request(`http://x/api/v1/me/subscribers${query}`, {
      headers: { authorization: "Bearer t" },
    }),
  );
  return { res, body: await res.json() };
}

beforeEach(() => {
  listSubscribers.mockReset();
  listSubscribers.mockResolvedValue(page);
});

describe("GET /api/v1/me/subscribers", () => {
  it("returns the reverse direction of the subscriptions with the private cache header", async () => {
    const { res, body } = await callRoute();

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(body).toEqual(page);
    expect(listSubscribers).toHaveBeenCalledWith({}, expect.any(Headers));
  });

  it("answers 401 without a session", async () => {
    listSubscribers.mockResolvedValue(unauthorised);

    const { res, body } = await callRoute();

    expect(res.status).toBe(401);
    expect(body).toEqual(unauthorised);
  });

  it("keeps the AD-12 envelope for unsupported methods", async () => {
    const { POST, PUT, PATCH, DELETE, HEAD } = await import("./route");

    for (const handler of [POST, PUT, PATCH, DELETE, HEAD]) {
      const res = handler(new Request("http://x/api/v1/me/subscribers"));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ ok: false, code: "NOT_FOUND", message: "Not found" });
    }
  });
});
