import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { listFriends } = vi.hoisted(() => ({ listFriends: vi.fn() }));

vi.mock("@/actions/circle", () => ({ listFriends }));

const page = {
  ok: true,
  data: {
    items: [
      {
        displayName: "Анна",
        nick: "anna",
        relationship: "FRIENDS",
        subscribed: true,
        followsYou: false,
      },
    ],
    nextCursor: "анна|cuid2",
    total: 17,
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
    new Request(`http://x/api/v1/me/friends${query}`, {
      headers: { authorization: "Bearer t" },
    }),
  );
  return { res, body: await res.json() };
}

beforeEach(() => {
  listFriends.mockReset();
  listFriends.mockResolvedValue(page);
});

describe("GET /api/v1/me/friends", () => {
  it("returns the page in the AD-12 envelope with a private cache header", async () => {
    const { res, body } = await callRoute("?q=%D0%90%D0%BD%D0%BD%D0%B0&cursor=anna%7Ccu");

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(body).toEqual(page);
    expect(listFriends).toHaveBeenCalledWith(
      { q: "Анна", cursor: "anna|cu" },
      expect.any(Headers),
    );
    const [, headers] = listFriends.mock.calls[0] as [unknown, Headers];
    expect(headers.get("authorization")).toBe("Bearer t");
  });

  it("passes no query as the whole circle", async () => {
    await callRoute();

    expect(listFriends).toHaveBeenCalledWith({}, expect.any(Headers));
  });

  it("accepts an empty q instead of rejecting it", async () => {
    const { res } = await callRoute("?q=");

    expect(res.status).toBe(200);
    expect(listFriends).toHaveBeenCalledWith({ q: "" }, expect.any(Headers));
  });

  it.each([
    [`?q=${"а".repeat(51)}`, "q"],
    ["?q=%D0%90%D0%BD%D0%BD%D0%B0%00", "q"],
  ])("answers VALIDATION with the field for an invalid query %s", async (query, field) => {
    const { res, body } = await callRoute(query);

    expect(res.status).toBe(400);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(body).toMatchObject({ ok: false, code: "VALIDATION", field });
    expect(listFriends).not.toHaveBeenCalled();
  });

  it("answers 401 without a session", async () => {
    listFriends.mockResolvedValue(unauthorised);

    const { res, body } = await callRoute();

    expect(res.status).toBe(401);
    expect(body).toEqual(unauthorised);
  });

  it("keeps the AD-12 envelope for unsupported methods", async () => {
    const { POST, PUT, PATCH, DELETE, HEAD } = await import("./route");

    for (const handler of [POST, PUT, PATCH, DELETE, HEAD]) {
      const res = handler(new Request("http://x/api/v1/me/friends"));
      expect(res.status).toBe(404);
      expect(res.headers.get("cache-control")).toBe("private, no-store");
      expect(await res.json()).toEqual({ ok: false, code: "NOT_FOUND", message: "Not found" });
    }
  });
});
