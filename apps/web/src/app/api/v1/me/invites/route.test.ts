import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { listInvites } = vi.hoisted(() => ({ listInvites: vi.fn() }));

vi.mock("@/actions/circle", () => ({ listInvites }));

const page = {
  items: [
    {
      displayName: "Анна",
      nick: "anna",
      relationship: "INCOMING_PENDING",
      subscribed: false,
      followsYou: false,
    },
  ],
  nextCursor: "анна|cuid2",
  total: 17,
};

const emptyPage = { items: [], nextCursor: null, total: 0 };

const data = { ok: true, data: { incoming: page, outgoing: emptyPage, incomingCount: 17 } };

const unauthorised = {
  ok: false,
  code: "UNAUTHENTICATED",
  message: "Authentication required",
};

async function callRoute(query = "") {
  const { GET } = await import("./route");
  const res = await GET(
    new Request(`http://x/api/v1/me/invites${query}`, {
      headers: { authorization: "Bearer t" },
    }),
  );
  return { res, body: await res.json() };
}

beforeEach(() => {
  listInvites.mockReset();
  listInvites.mockResolvedValue(data);
});

describe("GET /api/v1/me/invites", () => {
  it("returns both halves and the badge count in one answer with the private cache header", async () => {
    const { res, body } = await callRoute(
      "?incomingCursor=anna%7Ccu&outgoingCursor=boris%7Ccu",
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(body).toEqual(data);
    expect(listInvites).toHaveBeenCalledWith(
      { incomingCursor: "anna|cu", outgoingCursor: "boris|cu" },
      expect.any(Headers),
    );
  });

  it("passes no cursors for the first page", async () => {
    await callRoute();

    expect(listInvites).toHaveBeenCalledWith({}, expect.any(Headers));
  });

  it("answers 401 without a session", async () => {
    listInvites.mockResolvedValue(unauthorised);

    const { res, body } = await callRoute();

    expect(res.status).toBe(401);
    expect(body).toEqual(unauthorised);
  });

  it("maps a broken cursor to VALIDATION with the half's field", async () => {
    listInvites.mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      message: "Invalid cursor",
      field: "incomingCursor",
    });

    const { res, body } = await callRoute("?incomingCursor=%D0%BC%D1%83%D1%81%D0%BE%D1%80");

    expect(res.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid cursor",
      field: "incomingCursor",
    });
  });

  it("keeps the AD-12 envelope for unsupported methods", async () => {
    const { POST, PUT, PATCH, DELETE, HEAD } = await import("./route");

    for (const handler of [POST, PUT, PATCH, DELETE, HEAD]) {
      const res = handler(new Request("http://x/api/v1/me/invites"));
      expect(res.status).toBe(404);
      expect(res.headers.get("cache-control")).toBe("private, no-store");
      expect(await res.json()).toEqual({ ok: false, code: "NOT_FOUND", message: "Not found" });
    }
  });
});
