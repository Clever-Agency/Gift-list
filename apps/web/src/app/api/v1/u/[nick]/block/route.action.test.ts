import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, findUser, blockUser, unblockUser, store, reader } = vi.hoisted(() => ({
  getSession: vi.fn(),
  findUser: vi.fn(),
  blockUser: vi.fn(),
  unblockUser: vi.fn(),
  store: { transaction: vi.fn() },
  reader: { readBlockedPeople: vi.fn() },
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({ prisma: { user: { findUnique: findUser } } }));
vi.mock("@/lib/friendship-store", () => ({
  friendshipStore: store,
  blockedPeopleReader: reader,
}));
// Keep the real closed types and only replace the protocol boundary, so this
// test proves the route reaches the domain with the nick-resolved user id.
vi.mock("@/domain/block", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/domain/block")>();
  return { ...actual, blockUser, unblockUser };
});

const anna = { id: "u1", nickNormalized: "anna" };
const session = { user: { id: "u9" }, session: {} };

async function call(method: "POST" | "DELETE", nick: string, body?: string) {
  const route = await import("./route");
  const handler = method === "POST" ? route.POST : route.DELETE;
  const res = await handler(
    new Request(`http://x/api/v1/u/${encodeURIComponent(nick)}/block`, {
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
  blockUser.mockReset();
  unblockUser.mockReset();

  getSession.mockResolvedValue(session);
  findUser.mockImplementation(({ where }: { where: { nickNormalized: string } }) =>
    Promise.resolve(where.nickNormalized === anna.nickNormalized ? anna : null),
  );
  blockUser.mockResolvedValue({ ok: true, outcome: "BLOCKED" });
  unblockUser.mockResolvedValue({ ok: true, outcome: "UNBLOCKED" });
});

describe("POST /api/v1/u/:nick/block through the use-case", () => {
  it("calls the protocol with the session user and the nick-resolved target", async () => {
    const { res, body } = await call("POST", "AnNa", JSON.stringify({ otherUserId: "victim" }));

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, data: { outcome: "BLOCKED" } });
    expect(findUser).toHaveBeenCalledWith({
      where: { nickNormalized: "anna" },
      select: { id: true },
    });
    expect(blockUser).toHaveBeenCalledWith({ viewerId: "u9", otherUserId: "u1" }, store);
    expect(JSON.stringify(body)).not.toContain("victim");
  });

  it("returns ALREADY_BLOCKED as a successful no-op", async () => {
    blockUser.mockResolvedValue({ ok: true, outcome: "ALREADY_BLOCKED" });

    const { res, body } = await call("POST", "anna");

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, data: { outcome: "ALREADY_BLOCKED" } });
  });

  it("turns a self block into 403 without a reason, not 404", async () => {
    getSession.mockResolvedValue({ user: { id: anna.id }, session: {} });
    blockUser.mockResolvedValue({ ok: false, code: "FORBIDDEN" });

    const { res, body } = await call("POST", "anna");

    expect(res.status).toBe(403);
    expect(body).toEqual({ ok: false, code: "FORBIDDEN", message: "Forbidden" });
    expect(blockUser).toHaveBeenCalledWith(
      { viewerId: anna.id, otherUserId: anna.id },
      store,
    );
  });

  it("does not reach the protocol for an unknown nick", async () => {
    const { res, body } = await call("POST", "unknown");

    expect(res.status).toBe(404);
    expect(body).toEqual({ ok: false, code: "NOT_FOUND", message: "Not found" });
    expect(blockUser).not.toHaveBeenCalled();
  });

  it("never reveals a reverse block: the answer carries one closed outcome only", async () => {
    const { res, body } = await call("POST", "anna");

    expect(res.status).toBe(200);
    expect(Object.keys(body)).toEqual(["ok", "data"]);
    expect(Object.keys(body.data)).toEqual(["outcome"]);
    expect(reader.readBlockedPeople).not.toHaveBeenCalled();
  });

  it("answers 401 without a session and never touches the user or the protocol", async () => {
    getSession.mockResolvedValue(null);

    const { res, body } = await call("POST", "anna");

    expect(res.status).toBe(401);
    expect(body).toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
    expect(findUser).not.toHaveBeenCalled();
    expect(blockUser).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/v1/u/:nick/block through the use-case", () => {
  it("calls the protocol with the session user and the nick-resolved target", async () => {
    const { res, body } = await call("DELETE", "AnNa", JSON.stringify({ otherUserId: "victim" }));

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, data: { outcome: "UNBLOCKED" } });
    expect(unblockUser).toHaveBeenCalledWith({ viewerId: "u9", otherUserId: "u1" }, store);
    expect(JSON.stringify(body)).not.toContain("victim");
  });

  it("returns NOT_BLOCKED as a successful no-op", async () => {
    unblockUser.mockResolvedValue({ ok: true, outcome: "NOT_BLOCKED" });

    const { res, body } = await call("DELETE", "anna");

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, data: { outcome: "NOT_BLOCKED" } });
  });

  it("turns a self unblock into 403 and an unknown nick into 404", async () => {
    getSession.mockResolvedValue({ user: { id: anna.id }, session: {} });
    unblockUser.mockResolvedValue({ ok: false, code: "FORBIDDEN" });

    const self = await call("DELETE", "anna");
    expect(self.res.status).toBe(403);
    expect(self.body).toEqual({ ok: false, code: "FORBIDDEN", message: "Forbidden" });

    const unknown = await call("DELETE", "unknown");
    expect(unknown.res.status).toBe(404);
    expect(unknown.body).toEqual({ ok: false, code: "NOT_FOUND", message: "Not found" });
  });

  it("answers 401 without a session", async () => {
    getSession.mockResolvedValue(null);

    const { res, body } = await call("DELETE", "anna");

    expect(res.status).toBe(401);
    expect(body).toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
    expect(unblockUser).not.toHaveBeenCalled();
  });

  it("keeps the private cache header on both success and refusal", async () => {
    const success = await call("DELETE", "anna");
    expect(success.res.headers.get("cache-control")).toBe("private, no-store");

    unblockUser.mockResolvedValue({ ok: false, code: "FORBIDDEN" });
    const refusal = await call("DELETE", "anna");
    expect(refusal.res.headers.get("cache-control")).toBe("private, no-store");
  });
});
