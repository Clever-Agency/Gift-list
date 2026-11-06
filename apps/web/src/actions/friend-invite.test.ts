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
vi.mock("@/domain/friendship", () => ({ sendFriendInvite }));

import { sendInviteByNick } from "./friend-invite";

const anna = { id: "u1", nickNormalized: "anna" };
const users = [anna];

const session = { user: { id: "u9" }, session: {} };

beforeEach(() => {
  getSession.mockReset();
  findUser.mockReset();
  sendFriendInvite.mockReset();
  store.transaction.mockReset();

  getSession.mockResolvedValue(session);
  findUser.mockImplementation(({ where }: { where: { nickNormalized: string } }) =>
    Promise.resolve(users.find((user) => user.nickNormalized === where.nickNormalized) ?? null),
  );
  sendFriendInvite.mockResolvedValue({ ok: true, outcome: "INVITED" });
});

describe("sendInviteByNick", () => {
  it("answers UNAUTHENTICATED without reading a user or calling the protocol", async () => {
    getSession.mockResolvedValue(null);

    await expect(sendInviteByNick("anna", new Headers())).resolves.toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
    expect(findUser).not.toHaveBeenCalled();
    expect(sendFriendInvite).not.toHaveBeenCalled();
  });

  it("treats a malformed nick as NOT_FOUND without reading a user", async () => {
    for (const nick of ["", "ab", "a/b", "a\\b", "anna!", "x".repeat(25), "анна"]) {
      await expect(sendInviteByNick(nick, new Headers()), nick).resolves.toEqual({
        ok: false,
        code: "NOT_FOUND",
        message: "Not found",
      });
    }

    expect(findUser).not.toHaveBeenCalled();
    expect(sendFriendInvite).not.toHaveBeenCalled();
  });

  it("answers an unknown nick with the same NOT_FOUND and no name", async () => {
    const result = await sendInviteByNick("no-such-nick", new Headers());

    expect(result).toEqual({ ok: false, code: "NOT_FOUND", message: "Not found" });
    expect(JSON.stringify(result)).not.toContain("anna@example.com");
    expect(sendFriendInvite).not.toHaveBeenCalled();
  });

  it("resolves the nick case-insensitively and targets only the path nick", async () => {
    await sendInviteByNick("AnNa", new Headers());

    expect(findUser).toHaveBeenCalledWith({
      where: { nickNormalized: "anna" },
      select: { id: true },
    });
    expect(sendFriendInvite).toHaveBeenCalledWith(
      { fromUserId: "u9", toUserId: "u1" },
      store,
    );
  });

  it.each(["INVITED", "PENDING", "ALREADY_FRIENDS", "FRIENDS_CREATED"] as const)(
    "returns the closed outcome %s as a successful no-op or created invite",
    async (outcome) => {
      sendFriendInvite.mockResolvedValue({ ok: true, outcome });

      await expect(sendInviteByNick("anna", new Headers())).resolves.toEqual({
        ok: true,
        data: { outcome },
      });
    },
  );

  it("maps a self-invite refusal to one FORBIDDEN answer without a reason", async () => {
    sendFriendInvite.mockResolvedValue({
      ok: false,
      code: "FORBIDDEN",
      reason: "SELF_INVITE",
    });

    const result = await sendInviteByNick("anna", new Headers());

    expect(result).toEqual({ ok: false, code: "FORBIDDEN", message: "Forbidden" });
    expect(result).not.toHaveProperty("reason");
  });

  it("maps a Block refusal to the same FORBIDDEN answer without naming the block", async () => {
    sendFriendInvite.mockResolvedValue({
      ok: false,
      code: "FORBIDDEN",
      reason: "BLOCKED",
    });

    await expect(sendInviteByNick("anna", new Headers())).resolves.toEqual({
      ok: false,
      code: "FORBIDDEN",
      message: "Forbidden",
    });
  });

  it("never returns an email, name or list token on success", async () => {
    const result = await sendInviteByNick("anna", new Headers());

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("anna@example.com");
    expect(serialized).not.toContain("Анна");
    expect(serialized).not.toContain("publicToken");
  });

  it("passes the request headers to the session lookup", async () => {
    const headers = new Headers({ cookie: "sid=forged", "accept-language": "ru" });

    await sendInviteByNick("anna", headers);

    expect(getSession).toHaveBeenCalledWith({ headers });
  });
});
