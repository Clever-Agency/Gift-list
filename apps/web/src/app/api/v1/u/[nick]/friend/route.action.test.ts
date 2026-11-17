import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, findUser, removeFriend, store } = vi.hoisted(() => ({
  getSession: vi.fn(),
  findUser: vi.fn(),
  removeFriend: vi.fn(),
  store: { transaction: vi.fn() },
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({ prisma: { user: { findUnique: findUser } } }));
vi.mock("@/lib/friendship-store", () => ({ friendshipStore: store }));
// Keep the real closed types and only replace the protocol boundary, so this
// test proves the route reaches the domain with the nick-resolved user id.
vi.mock("@/domain/friendship", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/domain/friendship")>();
  return { ...actual, removeFriend };
});

const anna = { id: "u1", nickNormalized: "anna" };
const session = { user: { id: "u9" }, session: {} };

async function remove(nick: string, body?: string) {
  const { DELETE } = await import("./route");
  const res = await DELETE(
    new Request(`http://x/api/v1/u/${encodeURIComponent(nick)}/friend`, {
      method: "DELETE",
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
  removeFriend.mockReset();

  getSession.mockResolvedValue(session);
  findUser.mockImplementation(({ where }: { where: { nickNormalized: string } }) =>
    Promise.resolve(where.nickNormalized === anna.nickNormalized ? anna : null),
  );
  removeFriend.mockResolvedValue({ ok: true, outcome: "REMOVED" });
});

describe("DELETE /api/v1/u/:nick/friend through the use-case", () => {
  it("calls the protocol with the session user and the nick-resolved friend", async () => {
    const { res, body } = await remove("AnNa", JSON.stringify({ otherUserId: "victim" }));

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, data: { outcome: "REMOVED" } });
    expect(findUser).toHaveBeenCalledWith({
      where: { nickNormalized: "anna" },
      select: { id: true },
    });
    expect(removeFriend).toHaveBeenCalledWith({ viewerId: "u9", otherUserId: "u1" }, store);
    expect(JSON.stringify(body)).not.toContain("victim");
  });

  it("returns ALREADY_REMOVED as a successful no-op", async () => {
    removeFriend.mockResolvedValue({ ok: true, outcome: "ALREADY_REMOVED" });

    const { res, body } = await remove("anna");

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, data: { outcome: "ALREADY_REMOVED" } });
  });

  it("turns a domain FORBIDDEN into 403 without a reason", async () => {
    removeFriend.mockResolvedValue({ ok: false, code: "FORBIDDEN" });

    const { res, body } = await remove("anna", JSON.stringify({ otherUserId: "victim" }));

    expect(res.status).toBe(403);
    expect(body).toEqual({ ok: false, code: "FORBIDDEN", message: "Forbidden" });
    expect(removeFriend).toHaveBeenCalledWith({ viewerId: "u9", otherUserId: "u1" }, store);
  });

  it("does not reach the protocol for an unknown nick", async () => {
    const { res, body } = await remove("unknown");

    expect(res.status).toBe(404);
    expect(body).toEqual({ ok: false, code: "NOT_FOUND", message: "Not found" });
    expect(removeFriend).not.toHaveBeenCalled();
  });

  it("answers 401 without a session and never touches the user or the protocol", async () => {
    getSession.mockResolvedValue(null);

    const { res, body } = await remove("anna");

    expect(res.status).toBe(401);
    expect(body).toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
    expect(findUser).not.toHaveBeenCalled();
    expect(removeFriend).not.toHaveBeenCalled();
  });

  it("keeps the private cache header on both success and refusal", async () => {
    const success = await remove("anna");
    expect(success.res.headers.get("cache-control")).toBe("private, no-store");

    removeFriend.mockResolvedValue({ ok: false, code: "FORBIDDEN" });
    const refusal = await remove("anna");
    expect(refusal.res.headers.get("cache-control")).toBe("private, no-store");
  });
});
