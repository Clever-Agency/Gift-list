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
vi.mock("@/domain/friendship", () => ({ removeFriend }));

import { removeFriendByNick } from "./friend-remove";

const anna = { id: "u1", nickNormalized: "anna" };
const users = [anna];

const session = { user: { id: "u9" }, session: {} };

beforeEach(() => {
  getSession.mockReset();
  findUser.mockReset();
  removeFriend.mockReset();
  store.transaction.mockReset();

  getSession.mockResolvedValue(session);
  findUser.mockImplementation(({ where }: { where: { nickNormalized: string } }) =>
    Promise.resolve(users.find((user) => user.nickNormalized === where.nickNormalized) ?? null),
  );
  removeFriend.mockResolvedValue({ ok: true, outcome: "REMOVED" });
});

describe("removeFriendByNick (Story 4.4)", () => {
  it("answers UNAUTHENTICATED without reading a user or calling the protocol", async () => {
    getSession.mockResolvedValue(null);

    await expect(removeFriendByNick("anna", new Headers())).resolves.toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
    expect(findUser).not.toHaveBeenCalled();
    expect(removeFriend).not.toHaveBeenCalled();
  });

  it("treats a malformed or unknown nick as the same NOT_FOUND", async () => {
    for (const nick of ["", "ab", "a/b", "anna!", "x".repeat(25), "no-such-nick"]) {
      await expect(removeFriendByNick(nick, new Headers()), nick).resolves.toEqual({
        ok: false,
        code: "NOT_FOUND",
        message: "Not found",
      });
    }

    expect(removeFriend).not.toHaveBeenCalled();
  });

  it("removes with the session user as the actor and the nick as the other side", async () => {
    await removeFriendByNick("AnNa", new Headers());

    expect(findUser).toHaveBeenCalledWith({
      where: { nickNormalized: "anna" },
      select: { id: true },
    });
    expect(removeFriend).toHaveBeenCalledWith({ viewerId: "u9", otherUserId: "u1" }, store);
  });

  it.each(["REMOVED", "ALREADY_REMOVED"] as const)(
    "returns the closed remove outcome %s as a success",
    async (outcome) => {
      removeFriend.mockResolvedValue({ ok: true, outcome });

      await expect(removeFriendByNick("anna", new Headers())).resolves.toEqual({
        ok: true,
        data: { outcome },
      });
    },
  );

  it("maps a Block to FORBIDDEN without a reason", async () => {
    removeFriend.mockResolvedValue({ ok: false, code: "FORBIDDEN" });

    const result = await removeFriendByNick("anna", new Headers());

    expect(result).toEqual({ ok: false, code: "FORBIDDEN", message: "Forbidden" });
    expect(result).not.toHaveProperty("reason");
    expect(result).not.toHaveProperty("params");
  });

  it("maps the self pair (the session user's own nick) to FORBIDDEN, not NOT_FOUND", async () => {
    getSession.mockResolvedValue({ user: { id: anna.id }, session: {} });
    removeFriend.mockImplementation(
      ({ viewerId, otherUserId }: { viewerId: string; otherUserId: string }) =>
        Promise.resolve(
          viewerId === otherUserId
            ? { ok: false as const, code: "FORBIDDEN" as const }
            : { ok: true as const, outcome: "REMOVED" as const },
        ),
    );

    const result = await removeFriendByNick("anna", new Headers());

    expect(removeFriend).toHaveBeenCalledWith(
      { viewerId: anna.id, otherUserId: anna.id },
      store,
    );
    expect(result).toEqual({ ok: false, code: "FORBIDDEN", message: "Forbidden" });
    expect(result).not.toHaveProperty("reason");
  });

  it("never returns an email, name or token", async () => {
    const result = await removeFriendByNick("anna", new Headers());
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("anna@example.com");
    expect(serialized).not.toContain("Анна");
    expect(serialized).not.toContain("publicToken");
  });

  it("passes the request headers to the session lookup", async () => {
    const headers = new Headers({ authorization: "Bearer t" });

    await removeFriendByNick("anna", headers);

    expect(getSession).toHaveBeenCalledWith({ headers });
  });
});
