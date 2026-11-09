import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, findUser, rejectFriendInvite, store } = vi.hoisted(() => ({
  getSession: vi.fn(),
  findUser: vi.fn(),
  rejectFriendInvite: vi.fn(),
  store: { transaction: vi.fn() },
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({ prisma: { user: { findUnique: findUser } } }));
vi.mock("@/lib/friendship-store", () => ({ friendshipStore: store }));
// Keep the real closed types and only replace the protocol boundary, so this
// test proves the route reaches the domain with the nick-resolved inviter id.
vi.mock("@/domain/friendship", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/domain/friendship")>();
  return { ...actual, rejectFriendInvite };
});

const anna = { id: "u1", nickNormalized: "anna" };
const session = { user: { id: "u9" }, session: {} };

async function post(nick: string, body?: string) {
  const { POST } = await import("./route");
  const res = await POST(
    new Request(`http://x/api/v1/u/${encodeURIComponent(nick)}/invite/reject`, {
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
  rejectFriendInvite.mockReset();

  getSession.mockResolvedValue(session);
  findUser.mockImplementation(({ where }: { where: { nickNormalized: string } }) =>
    Promise.resolve(where.nickNormalized === anna.nickNormalized ? anna : null),
  );
  rejectFriendInvite.mockResolvedValue({ ok: true, outcome: "REJECTED" });
});

describe("POST /api/v1/u/:nick/invite/reject through the use-case", () => {
  it("rejects with the session user as recipient and the nick-resolved owner as inviter", async () => {
    const { res, body } = await post("AnNa", JSON.stringify({ fromUserId: "victim" }));

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, data: { outcome: "REJECTED" } });
    expect(findUser).toHaveBeenCalledWith({
      where: { nickNormalized: "anna" },
      select: { id: true },
    });
    expect(rejectFriendInvite).toHaveBeenCalledWith({ fromUserId: "u1", viewerId: "u9" }, store);
    expect(JSON.stringify(body)).not.toContain("victim");
  });

  it("turns a domain FORBIDDEN into 403 without a reason or cooldown", async () => {
    rejectFriendInvite.mockResolvedValue({ ok: false, code: "FORBIDDEN" });

    const { res, body } = await post("anna");

    expect(res.status).toBe(403);
    expect(body).toEqual({ ok: false, code: "FORBIDDEN", message: "Forbidden" });
    expect(body).not.toHaveProperty("reason");
    expect(body).not.toHaveProperty("params");
  });

  it("turns a non-recipient or missing pending into the closed 404", async () => {
    rejectFriendInvite.mockResolvedValue({ ok: false, code: "NOT_FOUND" });

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
    expect(rejectFriendInvite).not.toHaveBeenCalled();
  });

  it("does not reach the protocol for an unknown nick", async () => {
    const { res, body } = await post("unknown");

    expect(res.status).toBe(404);
    expect(body).toEqual({ ok: false, code: "NOT_FOUND", message: "Not found" });
    expect(rejectFriendInvite).not.toHaveBeenCalled();
  });
});
