import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { listBlocked } = vi.hoisted(() => ({ listBlocked: vi.fn() }));

vi.mock("@/actions/block", () => ({ listBlocked }));

const page = {
  ok: true,
  data: {
    items: [{ displayName: "Анна", nick: "anna" }],
    nextCursor: "1763287200000|cu2",
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
    new Request(`http://x/api/v1/me/blocks${query}`, {
      headers: { authorization: "Bearer t" },
    }),
  );
  return { res, body: await res.json() };
}

beforeEach(() => {
  listBlocked.mockReset();
  listBlocked.mockResolvedValue(page);
});

describe("GET /api/v1/me/blocks", () => {
  it("returns the viewer's own blocks with the private cache header", async () => {
    const { res, body } = await callRoute("?cursor=1763287200000%7Ccu1");

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(body).toEqual(page);
    expect(listBlocked).toHaveBeenCalledWith(
      { cursor: "1763287200000|cu1" },
      expect.any(Headers),
    );
    const [, headers] = listBlocked.mock.calls[0] as [unknown, Headers];
    expect(headers.get("authorization")).toBe("Bearer t");
  });

  it("passes no cursor as the first page", async () => {
    await callRoute();

    expect(listBlocked).toHaveBeenCalledWith({}, expect.any(Headers));
  });

  it("keeps the cursor the server issued, even a blank one", async () => {
    await callRoute("?cursor=");

    expect(listBlocked).toHaveBeenCalledWith({ cursor: "" }, expect.any(Headers));
  });

  it("answers 401 without a session", async () => {
    listBlocked.mockResolvedValue(unauthorised);

    const { res, body } = await callRoute();

    expect(res.status).toBe(401);
    expect(body).toEqual(unauthorised);
  });

  it("answers VALIDATION for a query parameter outside the list contract", async () => {
    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://x/api/v1/me/blocks?q=%D0%90%D0%BD%D0%BD%D0%B0"),
    );

    expect(res.status).toBe(400);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
    });
    expect(listBlocked).not.toHaveBeenCalled();
  });

  it("keeps the AD-12 envelope for unsupported methods", async () => {
    const { POST, PUT, PATCH, DELETE, HEAD } = await import("./route");

    for (const handler of [POST, PUT, PATCH, DELETE, HEAD]) {
      const res = handler(new Request("http://x/api/v1/me/blocks"));
      expect(res.status).toBe(404);
      expect(res.headers.get("cache-control")).toBe("private, no-store");
      expect(await res.json()).toEqual({ ok: false, code: "NOT_FOUND", message: "Not found" });
    }
    expect(listBlocked).not.toHaveBeenCalled();
  });
});
