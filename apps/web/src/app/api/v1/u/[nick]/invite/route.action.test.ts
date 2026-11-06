import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, findUser, sendFriendInvite, store } = vi.hoisted(() => ({
  getSession: vi.fn(),
  findUser: vi.fn(),
  sendFriendInvite: vi.fn(),
  store: { transaction: vi.fn() },
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({ prisma: { user: { findUnique: findUser } } }));
vi.mock("@/lib/friendship-store", () => ({ friendshipStore: store }));
// Keep the real closed types and only replace the protocol boundary, so this
// test proves the route reaches the domain with the nick-resolved user id.
vi.mock("@/domain/friendship", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/domain/friendship")>();
  return { ...actual, sendFriendInvite };
});

const anna = { id: "u1", nickNormalized: "anna" };
const session = { user: { id: "u9" }, session: {} };

async function post(nick: string, body?: string) {
  const { POST } = await import("./route");
  const res = await POST(
    new Request(`http://x/api/v1/u/${encodeURIComponent(nick)}/invite`, {
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
  sendFriendInvite.mockReset();

  getSession.mockResolvedValue(session);
  findUser.mockImplementation(({ where }: { where: { nickNormalized: string } }) =>
    Promise.resolve(where.nickNormalized === anna.nickNormalized ? anna : null),
  );
  sendFriendInvite.mockResolvedValue({ ok: true, outcome: "INVITED" });
});

describe("POST /api/v1/u/:nick/invite through the use-case", () => {
  it("calls the protocol with the session user and the nick-resolved owner", async () => {
    const { res, body } = await post("AnNa", JSON.stringify({ toUserId: "victim" }));

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, data: { outcome: "INVITED" } });
    expect(findUser).toHaveBeenCalledWith({
      where: { nickNormalized: "anna" },
      select: { id: true },
    });
    expect(sendFriendInvite).toHaveBeenCalledWith({ fromUserId: "u9", toUserId: "u1" }, store);
    expect(JSON.stringify(body)).not.toContain("victim");
  });

  it("returns PENDING and ALREADY_FRIENDS as successful no-ops", async () => {
    for (const outcome of ["PENDING", "ALREADY_FRIENDS"] as const) {
      sendFriendInvite.mockResolvedValue({ ok: true, outcome });
      const { res, body } = await post("anna");
      expect(res.status).toBe(200);
      expect(body).toEqual({ ok: true, data: { outcome } });
    }
  });

  it("turns a domain FORBIDDEN into 403 and never calls the body's user id", async () => {
    sendFriendInvite.mockResolvedValue({ ok: false, code: "FORBIDDEN", reason: "BLOCKED" });

    const { res, body } = await post("anna", JSON.stringify({ toUserId: "victim" }));

    expect(res.status).toBe(403);
    expect(body).toEqual({ ok: false, code: "FORBIDDEN", message: "Forbidden" });
    expect(sendFriendInvite).toHaveBeenCalledWith({ fromUserId: "u9", toUserId: "u1" }, store);
  });

  it("exposes a live cooldown as 429 INVITE_COOLDOWN with hours, not FORBIDDEN", async () => {
    sendFriendInvite.mockResolvedValue({
      ok: false,
      code: "RATE_LIMITED",
      reason: "INVITE_COOLDOWN",
      hours: 5,
    });

    const { res, body } = await post("anna", JSON.stringify({ toUserId: "victim" }));

    expect(res.status).toBe(429);
    expect(body).toEqual({
      ok: false,
      code: "RATE_LIMITED",
      message: "Invite cooldown is active",
      reason: "INVITE_COOLDOWN",
      params: { hours: 5 },
    });
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(JSON.stringify(body)).not.toContain("victim");
  });

  it("does not reach the protocol for an unknown nick", async () => {
    const { res, body } = await post("unknown");

    expect(res.status).toBe(404);
    expect(body).toEqual({ ok: false, code: "NOT_FOUND", message: "Not found" });
    expect(sendFriendInvite).not.toHaveBeenCalled();
  });
});
