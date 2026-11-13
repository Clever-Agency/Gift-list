import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, findUser, createSubscription, deleteSubscription, hasBlockBetween } =
  vi.hoisted(() => ({
    getSession: vi.fn(),
    findUser: vi.fn(),
    createSubscription: vi.fn(),
    deleteSubscription: vi.fn(),
    hasBlockBetween: vi.fn(),
  }));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({ prisma: { user: { findUnique: findUser } } }));
vi.mock("@/lib/subscription-store", () => ({
  subscriptionStore: { createSubscription, deleteSubscription, hasBlockBetween },
}));

const userIds: Record<string, string> = { anna: "u1", owner: "u9" };
const session = { user: { id: "u9" }, session: {} };

async function call(
  method: "POST" | "DELETE",
  nick: string,
  body?: string,
): Promise<{ res: Response; body: unknown }> {
  const { POST, DELETE } = await import("./route");
  const res = await (method === "POST" ? POST : DELETE)(
    new Request(`http://x/api/v1/u/${encodeURIComponent(nick)}/subscription`, {
      method,
      headers: { "content-type": "application/json" },
      ...(body === undefined ? {} : { body }),
    }),
    { params: Promise.resolve({ nick }) },
  );
  return { res, body: await res.json() };
}

beforeEach(() => {
  getSession.mockReset();
  findUser.mockReset();
  createSubscription.mockReset();
  deleteSubscription.mockReset();
  hasBlockBetween.mockReset();

  getSession.mockResolvedValue(session);
  findUser.mockImplementation(({ where }: { where: { nickNormalized: string } }) => {
    const id = userIds[where.nickNormalized];
    return Promise.resolve(id === undefined ? null : { id });
  });
  createSubscription.mockResolvedValue(true);
  deleteSubscription.mockResolvedValue(true);
  hasBlockBetween.mockResolvedValue(false);
});

describe("POST /api/v1/u/:nick/subscription through the use-case", () => {
  it("creates the directed row from the session user to the nick-resolved owner", async () => {
    const { res, body } = await call(
      "POST",
      "AnNa",
      JSON.stringify({ toUserId: "victim", userId: "u1" }),
    );

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, data: { outcome: "SUBSCRIBED" } });
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(createSubscription).toHaveBeenCalledWith("u9", "u1");
  });

  it("returns a repeat as the successful no-op ALREADY_SUBSCRIBED", async () => {
    createSubscription.mockResolvedValue(false);

    const { res, body } = await call("POST", "anna");

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, data: { outcome: "ALREADY_SUBSCRIBED" } });
  });

  it("answers UNAUTHENTICATED without touching the database", async () => {
    getSession.mockResolvedValue(null);

    const { res, body } = await call("POST", "anna");

    expect(res.status).toBe(401);
    expect(body).toEqual({ ok: false, code: "UNAUTHENTICATED", message: "Authentication required" });
    expect(findUser).not.toHaveBeenCalled();
    expect(createSubscription).not.toHaveBeenCalled();
  });

  it("answers an unknown nick with the closed NOT_FOUND", async () => {
    const { res, body } = await call("POST", "no-such-nick");

    expect(res.status).toBe(404);
    expect(body).toEqual({ ok: false, code: "NOT_FOUND", message: "Not found" });
    expect(createSubscription).not.toHaveBeenCalled();
  });

  it("turns a self subscription into 403 FORBIDDEN", async () => {
    const { res, body } = await call("POST", "owner");

    expect(res.status).toBe(403);
    expect(body).toEqual({ ok: false, code: "FORBIDDEN", message: "Forbidden" });
    expect(createSubscription).not.toHaveBeenCalled();
  });

  it("turns a Block in either direction into 403 FORBIDDEN", async () => {
    hasBlockBetween.mockResolvedValue(true);

    const { res, body } = await call("POST", "anna");

    expect(res.status).toBe(403);
    expect(body).toEqual({ ok: false, code: "FORBIDDEN", message: "Forbidden" });
    expect(createSubscription).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/v1/u/:nick/subscription through the use-case", () => {
  it("removes the viewer's own directed row", async () => {
    const { res, body } = await call("DELETE", "AnNa");

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, data: { outcome: "UNSUBSCRIBED" } });
    expect(deleteSubscription).toHaveBeenCalledWith("u9", "u1");
  });

  it("returns a repeat removal as the successful no-op NOT_SUBSCRIBED", async () => {
    deleteSubscription.mockResolvedValue(false);

    const { res, body } = await call("DELETE", "anna");

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, data: { outcome: "NOT_SUBSCRIBED" } });
  });
});
