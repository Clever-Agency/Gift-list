import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, findUser, acceptFriendInvite, store } = vi.hoisted(() => ({
  getSession: vi.fn(),
  findUser: vi.fn(),
  acceptFriendInvite: vi.fn(),
  store: { transaction: vi.fn() },
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({ prisma: { user: { findUnique: findUser } } }));
vi.mock("@/lib/friendship-store", () => ({ friendshipStore: store }));
// Keep the real closed types and only replace the protocol boundary, so this
// test proves the route reaches the domain with the nick-resolved inviter id.
vi.mock("@/domain/friendship", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/domain/friendship")>();
  return { ...actual, acceptFriendInvite };
});

const anna = { id: "u1", nickNormalized: "anna" };
const session = { user: { id: "u9" }, session: {} };

async function post(nick: string, body?: string) {
  const { POST } = await import("./route");
  const res = await POST(
    new Request(`http://x/api/v1/u/${encodeURIComponent(nick)}/invite/accept`, {
      method: "POST",
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
  acceptFriendInvite.mockReset();

  getSession.mockResolvedValue(session);
  findUser.mockImplementation(({ where }: { where: { nickNormalized: string } }) =>
    Promise.resolve(where.nickNormalized === anna.nickNormalized ? anna : null),
  );
  acceptFriendInvite.mockResolvedValue({ ok: true, outcome: "FRIENDS_CREATED" });
});

describe("POST /api/v1/u/:nick/invite/accept through the use-case", () => {
  it("accepts with the session user as recipient and the nick-resolved owner as inviter", async () => {
    const { res, body } = await post("AnNa", JSON.stringify({ fromUserId: "victim" }));

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, data: { outcome: "FRIENDS_CREATED" } });
    expect(findUser).toHaveBeenCalledWith({
      where: { nickNormalized: "anna" },
      select: { id: true },
    });
    expect(acceptFriendInvite).toHaveBeenCalledWith({ fromUserId: "u1", viewerId: "u9" }, store);
    expect(JSON.stringify(body)).not.toContain("victim");
  });

  it("returns ALREADY_FRIENDS as a successful idempotent outcome", async () => {
    acceptFriendInvite.mockResolvedValue({ ok: true, outcome: "ALREADY_FRIENDS" });

    const { res, body } = await post("anna");

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, data: { outcome: "ALREADY_FRIENDS" } });
  });

  it("turns a domain FORBIDDEN into 403 without a reason or cooldown", async () => {
    acceptFriendInvite.mockResolvedValue({ ok: false, code: "FORBIDDEN" });

    const { res, body } = await post("anna");

    expect(res.status).toBe(403);
    expect(body).toEqual({ ok: false, code: "FORBIDDEN", message: "Forbidden" });
    expect(body).not.toHaveProperty("reason");
    expect(body).not.toHaveProperty("params");
  });

  it("turns a non-recipient or missing pending into the closed 404", async () => {
    acceptFriendInvite.mockResolvedValue({ ok: false, code: "NOT_FOUND" });

    const { res, body } = await post("anna");

    expect(res.status).toBe(404);
    expect(body).toEqual({ ok: false, code: "NOT_FOUND", message: "Not found" });
  });

  it("answers 401 without a session and never reaches the protocol", async () => {
    getSession.mockResolvedValue(null);

    const { res, body } = await post("anna");

    expect(res.status).toBe(401);
    expect(body).toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
    expect(acceptFriendInvite).not.toHaveBeenCalled();
  });

  it("does not reach the protocol for an unknown nick", async () => {
    const { res, body } = await post("unknown");

    expect(res.status).toBe(404);
    expect(body).toEqual({ ok: false, code: "NOT_FOUND", message: "Not found" });
    expect(acceptFriendInvite).not.toHaveBeenCalled();
  });
});
