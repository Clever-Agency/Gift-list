import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { listSubscriptions } = vi.hoisted(() => ({ listSubscriptions: vi.fn() }));

vi.mock("@/actions/circle", () => ({ listSubscriptions }));

const page = {
  ok: true,
  data: {
    items: [
      {
        displayName: "Иван",
        nick: "ivan",
        relationship: "FRIENDS",
        subscribed: true,
        followsYou: false,
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
    new Request(`http://x/api/v1/me/subscriptions${query}`, {
      headers: { authorization: "Bearer t" },
    }),
  );
  return { res, body: await res.json() };
}

beforeEach(() => {
  listSubscriptions.mockReset();
  listSubscriptions.mockResolvedValue(page);
});

describe("GET /api/v1/me/subscriptions", () => {
  it("returns the viewer's own subscriptions with the private cache header", async () => {
    const { res, body } = await callRoute("?cursor=ivan%7Ccu");

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(body).toEqual(page);
    expect(listSubscriptions).toHaveBeenCalledWith({ cursor: "ivan|cu" }, expect.any(Headers));
  });

  it("answers VALIDATION for an over-long q and does not call the action", async () => {
    const { res, body } = await callRoute(`?q=${"а".repeat(51)}`);

    expect(res.status).toBe(400);
    expect(body).toMatchObject({ ok: false, code: "VALIDATION", field: "q" });
    expect(listSubscriptions).not.toHaveBeenCalled();
  });

  it("answers 401 without a session", async () => {
    listSubscriptions.mockResolvedValue(unauthorised);

    const { res, body } = await callRoute();

    expect(res.status).toBe(401);
    expect(body).toEqual(unauthorised);
  });

  it("keeps the AD-12 envelope for unsupported methods", async () => {
    const { POST, PUT, PATCH, DELETE, HEAD } = await import("./route");

    for (const handler of [POST, PUT, PATCH, DELETE, HEAD]) {
      const res = handler(new Request("http://x/api/v1/me/subscriptions"));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ ok: false, code: "NOT_FOUND", message: "Not found" });
    }
  });
});
