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

import { removeSubscriberByNick, subscribeByNick, unsubscribeByNick } from "./subscription";

/** The session user is `owner` (u9); `anna` (u1) is somebody else. */
const userIds: Record<string, string> = { anna: "u1", owner: "u9" };
const session = { user: { id: "u9" }, session: {} };

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

describe("subscribeByNick (Story 4.6, FR-46, AD-19)", () => {
  it.each([
    ["subscribeByNick", subscribeByNick],
    ["unsubscribeByNick", unsubscribeByNick],
  ] as const)(
    "%s answers UNAUTHENTICATED without a user lookup or a write",
    async (_name, action) => {
      getSession.mockResolvedValue(null);

      await expect(action("anna", new Headers())).resolves.toEqual({
        ok: false,
        code: "UNAUTHENTICATED",
        message: "Authentication required",
      });
      expect(findUser).not.toHaveBeenCalled();
      expect(createSubscription).not.toHaveBeenCalled();
      expect(deleteSubscription).not.toHaveBeenCalled();
    },
  );

  it.each(["", "ab", "a/b", "anna!", "x".repeat(25), "анна"])(
    "treats the malformed nick %j as NOT_FOUND without reading a user",
    async (nick) => {
      await expect(subscribeByNick(nick, new Headers())).resolves.toEqual({
        ok: false,
        code: "NOT_FOUND",
        message: "Not found",
      });
      expect(findUser).not.toHaveBeenCalled();
      expect(createSubscription).not.toHaveBeenCalled();
    },
  );

  it("answers an unknown nick with the same NOT_FOUND and no name", async () => {
    const result = await subscribeByNick("no-such-nick", new Headers());

    expect(result).toEqual({ ok: false, code: "NOT_FOUND", message: "Not found" });
    expect(JSON.stringify(result)).not.toContain("anna@example.com");
    expect(createSubscription).not.toHaveBeenCalled();
  });

  it("subscribes the session user to the nick-resolved owner, case-insensitively", async () => {
    await expect(subscribeByNick("AnNa", new Headers())).resolves.toEqual({
      ok: true,
      data: { outcome: "SUBSCRIBED" },
    });
    expect(findUser).toHaveBeenCalledWith({
      where: { nickNormalized: "anna" },
      select: { id: true },
    });
    expect(hasBlockBetween).toHaveBeenCalledWith("u9", "u1");
    expect(createSubscription).toHaveBeenCalledWith("u9", "u1");
  });

  it("returns a repeat as the successful no-op ALREADY_SUBSCRIBED", async () => {
    createSubscription.mockResolvedValue(false);

    await expect(subscribeByNick("anna", new Headers())).resolves.toEqual({
      ok: true,
      data: { outcome: "ALREADY_SUBSCRIBED" },
    });
  });

  it("maps a self subscription to one FORBIDDEN answer without a reason", async () => {
    const result = await subscribeByNick("owner", new Headers());

    expect(result).toEqual({ ok: false, code: "FORBIDDEN", message: "Forbidden" });
    expect(result).not.toHaveProperty("reason");
    expect(createSubscription).not.toHaveBeenCalled();
  });

  it("maps a Block in either direction to the same FORBIDDEN answer", async () => {
    hasBlockBetween.mockResolvedValue(true);

    const result = await subscribeByNick("anna", new Headers());

    expect(result).toEqual({ ok: false, code: "FORBIDDEN", message: "Forbidden" });
    expect(createSubscription).not.toHaveBeenCalled();
  });

  it("passes the request headers to the session lookup", async () => {
    const headers = new Headers({ cookie: "sid=forged" });

    await subscribeByNick("anna", headers);

    expect(getSession).toHaveBeenCalledWith({ headers });
  });
});

describe("unsubscribeByNick (Story 4.6, AD-19)", () => {
  it("removes the viewer's own directed edge to the nick-resolved owner", async () => {
    await expect(unsubscribeByNick("AnNa", new Headers())).resolves.toEqual({
      ok: true,
      data: { outcome: "UNSUBSCRIBED" },
    });
    expect(deleteSubscription).toHaveBeenCalledWith("u9", "u1");
  });

  it("treats a repeat as the successful no-op NOT_SUBSCRIBED", async () => {
    deleteSubscription.mockResolvedValue(false);

    await expect(unsubscribeByNick("anna", new Headers())).resolves.toEqual({
      ok: true,
      data: { outcome: "NOT_SUBSCRIBED" },
    });
  });

  it("does not refuse a removal because of a Block and does not even read one", async () => {
    hasBlockBetween.mockResolvedValue(true);

    await expect(unsubscribeByNick("anna", new Headers())).resolves.toEqual({
      ok: true,
      data: { outcome: "UNSUBSCRIBED" },
    });
    expect(hasBlockBetween).not.toHaveBeenCalled();
    expect(deleteSubscription).toHaveBeenCalledWith("u9", "u1");
  });

  it("answers NOT_FOUND for an unknown owner without a write", async () => {
    await expect(unsubscribeByNick("no-such-nick", new Headers())).resolves.toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Not found",
    });
    expect(deleteSubscription).not.toHaveBeenCalled();
  });
});

describe("removeSubscriberByNick (Story 4.6, AD-19)", () => {
  it("lets the profile owner remove a subscriber by the subscriber's nick", async () => {
    await expect(removeSubscriberByNick("owner", "AnNa", new Headers())).resolves.toEqual({
      ok: true,
      data: { outcome: "UNSUBSCRIBED" },
    });
    expect(deleteSubscription).toHaveBeenCalledWith("u1", "u9");
  });

  it("treats a repeat as the successful no-op NOT_SUBSCRIBED", async () => {
    deleteSubscription.mockResolvedValue(false);

    await expect(removeSubscriberByNick("owner", "anna", new Headers())).resolves.toEqual({
      ok: true,
      data: { outcome: "NOT_SUBSCRIBED" },
    });
  });

  it("refuses a stranger before the subscriber nick is resolved", async () => {
    const result = await removeSubscriberByNick("anna", "owner", new Headers());

    expect(result).toEqual({ ok: false, code: "FORBIDDEN", message: "Forbidden" });
    expect(findUser).toHaveBeenCalledTimes(1);
    expect(deleteSubscription).not.toHaveBeenCalled();
  });

  it("answers NOT_FOUND for an unknown profile nick without a write", async () => {
    await expect(removeSubscriberByNick("no-such-nick", "anna", new Headers())).resolves.toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Not found",
    });
    expect(deleteSubscription).not.toHaveBeenCalled();
  });

  it("answers NOT_FOUND for an unknown subscriber nick without a write", async () => {
    await expect(removeSubscriberByNick("owner", "no-such-nick", new Headers())).resolves.toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Not found",
    });
    expect(deleteSubscription).not.toHaveBeenCalled();
  });

  it("answers UNAUTHENTICATED without a lookup or a write", async () => {
    getSession.mockResolvedValue(null);

    await expect(removeSubscriberByNick("owner", "anna", new Headers())).resolves.toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
    expect(findUser).not.toHaveBeenCalled();
    expect(deleteSubscription).not.toHaveBeenCalled();
  });

  it("never returns an email, name or list token", async () => {
    const result = await removeSubscriberByNick("owner", "anna", new Headers());
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("anna@example.com");
    expect(serialized).not.toContain("Анна");
    expect(serialized).not.toContain("publicToken");
  });
});
