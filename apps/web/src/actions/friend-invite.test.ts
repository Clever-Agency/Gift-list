import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, findUser, sendFriendInvite, acceptFriendInvite, rejectFriendInvite, store } =
  vi.hoisted(() => ({
    getSession: vi.fn(),
    findUser: vi.fn(),
    sendFriendInvite: vi.fn(),
    acceptFriendInvite: vi.fn(),
    rejectFriendInvite: vi.fn(),
    store: { transaction: vi.fn() },
  }));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({ prisma: { user: { findUnique: findUser } } }));
vi.mock("@/lib/friendship-store", () => ({ friendshipStore: store }));
vi.mock("@/domain/friendship", () => ({
  sendFriendInvite,
  acceptFriendInvite,
  rejectFriendInvite,
}));

import { acceptInviteByNick, rejectInviteByNick, sendInviteByNick } from "./friend-invite";

const anna = { id: "u1", nickNormalized: "anna" };
const users = [anna];

const session = { user: { id: "u9" }, session: {} };

beforeEach(() => {
  getSession.mockReset();
  findUser.mockReset();
  sendFriendInvite.mockReset();
  acceptFriendInvite.mockReset();
  rejectFriendInvite.mockReset();
  store.transaction.mockReset();

  getSession.mockResolvedValue(session);
  findUser.mockImplementation(({ where }: { where: { nickNormalized: string } }) =>
    Promise.resolve(users.find((user) => user.nickNormalized === where.nickNormalized) ?? null),
  );
  sendFriendInvite.mockResolvedValue({ ok: true, outcome: "INVITED" });
  acceptFriendInvite.mockResolvedValue({ ok: true, outcome: "FRIENDS_CREATED" });
  rejectFriendInvite.mockResolvedValue({ ok: true, outcome: "REJECTED" });
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

  it("keeps a live cooldown as RATE_LIMITED/INVITE_COOLDOWN with whole hours", async () => {
    sendFriendInvite.mockResolvedValue({
      ok: false,
      code: "RATE_LIMITED",
      reason: "INVITE_COOLDOWN",
      hours: 7,
    });

    const result = await sendInviteByNick("anna", new Headers());

    expect(result).toEqual({
      ok: false,
      code: "RATE_LIMITED",
      message: "Invite cooldown is active",
      reason: "INVITE_COOLDOWN",
      params: { hours: 7 },
    });
    expect(result).not.toEqual(expect.objectContaining({ code: "FORBIDDEN" }));
    expect(JSON.stringify(result)).not.toContain("Too many requests");
  });
});

describe("acceptInviteByNick (Story 4.2.2)", () => {
  it("answers UNAUTHENTICATED without reading a user or calling the protocol", async () => {
    getSession.mockResolvedValue(null);

    await expect(acceptInviteByNick("anna", new Headers())).resolves.toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
    expect(findUser).not.toHaveBeenCalled();
    expect(acceptFriendInvite).not.toHaveBeenCalled();
  });

  it("treats a malformed or unknown nick as the same NOT_FOUND", async () => {
    for (const nick of ["", "ab", "a/b", "anna!", "x".repeat(25), "no-such-nick"]) {
      await expect(acceptInviteByNick(nick, new Headers()), nick).resolves.toEqual({
        ok: false,
        code: "NOT_FOUND",
        message: "Not found",
      });
    }

    expect(acceptFriendInvite).not.toHaveBeenCalled();
  });

  it("accepts the incoming invite with the session user as recipient", async () => {
    await acceptInviteByNick("AnNa", new Headers());

    expect(findUser).toHaveBeenCalledWith({
      where: { nickNormalized: "anna" },
      select: { id: true },
    });
    expect(acceptFriendInvite).toHaveBeenCalledWith({ fromUserId: "u1", viewerId: "u9" }, store);
  });

  it.each(["FRIENDS_CREATED", "ALREADY_FRIENDS"] as const)(
    "returns the closed accept outcome %s",
    async (outcome) => {
      acceptFriendInvite.mockResolvedValue({ ok: true, outcome });

      await expect(acceptInviteByNick("anna", new Headers())).resolves.toEqual({
        ok: true,
        data: { outcome },
      });
    },
  );

  it("maps a Block to FORBIDDEN without a reason", async () => {
    acceptFriendInvite.mockResolvedValue({ ok: false, code: "FORBIDDEN" });

    const result = await acceptInviteByNick("anna", new Headers());

    expect(result).toEqual({ ok: false, code: "FORBIDDEN", message: "Forbidden" });
    expect(result).not.toHaveProperty("reason");
    expect(result).not.toHaveProperty("params");
  });

  it("maps a non-recipient or missing pending to the closed NOT_FOUND", async () => {
    acceptFriendInvite.mockResolvedValue({ ok: false, code: "NOT_FOUND" });

    await expect(acceptInviteByNick("anna", new Headers())).resolves.toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Not found",
    });
  });

  it("never returns an email, name or token on success", async () => {
    const result = await acceptInviteByNick("anna", new Headers());
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("anna@example.com");
    expect(serialized).not.toContain("Анна");
    expect(serialized).not.toContain("publicToken");
  });
});

describe("rejectInviteByNick (Story 4.2.2)", () => {
  it("answers UNAUTHENTICATED without reading a user or calling the protocol", async () => {
    getSession.mockResolvedValue(null);

    await expect(rejectInviteByNick("anna", new Headers())).resolves.toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
    expect(findUser).not.toHaveBeenCalled();
    expect(rejectFriendInvite).not.toHaveBeenCalled();
  });

  it("treats a malformed or unknown nick as the same NOT_FOUND", async () => {
    for (const nick of ["", "ab", "a/b", "anna!", "x".repeat(25), "no-such-nick"]) {
      await expect(rejectInviteByNick(nick, new Headers()), nick).resolves.toEqual({
        ok: false,
        code: "NOT_FOUND",
        message: "Not found",
      });
    }

    expect(rejectFriendInvite).not.toHaveBeenCalled();
  });

  it("rejects the incoming invite with the session user as recipient", async () => {
    await rejectInviteByNick("AnNa", new Headers());

    expect(findUser).toHaveBeenCalledWith({
      where: { nickNormalized: "anna" },
      select: { id: true },
    });
    expect(rejectFriendInvite).toHaveBeenCalledWith({ fromUserId: "u1", viewerId: "u9" }, store);
  });

  it("returns the closed REJECTED acknowledgement without error text", async () => {
    await expect(rejectInviteByNick("anna", new Headers())).resolves.toEqual({
      ok: true,
      data: { outcome: "REJECTED" },
    });
  });

  it("maps a Block to FORBIDDEN without a reason or cooldown fields", async () => {
    rejectFriendInvite.mockResolvedValue({ ok: false, code: "FORBIDDEN" });

    const result = await rejectInviteByNick("anna", new Headers());

    expect(result).toEqual({ ok: false, code: "FORBIDDEN", message: "Forbidden" });
    expect(result).not.toHaveProperty("reason");
    expect(result).not.toHaveProperty("params");
  });

  it("maps a non-recipient or missing pending to the closed NOT_FOUND", async () => {
    rejectFriendInvite.mockResolvedValue({ ok: false, code: "NOT_FOUND" });

    await expect(rejectInviteByNick("anna", new Headers())).resolves.toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Not found",
    });
  });
});
