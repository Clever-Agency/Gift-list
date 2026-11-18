import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, readInviteLinkToken, store, writes } = vi.hoisted(() => ({
  getSession: vi.fn(),
  readInviteLinkToken: vi.fn(),
  writes: [] as string[],
  store: {
    findOwnerByToken: vi.fn(),
    hasBlockBetween: vi.fn(),
    findFriendship: vi.fn(),
    lockPair: vi.fn(),
    createFriendship: vi.fn(),
    deleteInvitesBetween: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/lib/invite-link-store", () => ({ readInviteLinkToken, inviteLinkStore: store }));

import { acceptInviteByToken, getInvitePreview, getMyInviteLink } from "./invite-link";

const anna = { id: "u1", displayName: "Анна", nick: "anna" };
const viewer = { id: "u9" };
const session = { user: viewer, session: {} };

const unauthenticated = {
  ok: false,
  code: "UNAUTHENTICATED",
  message: "Authentication required",
};
const notFound = { ok: false, code: "NOT_FOUND", message: "Not found" };
const forbidden = { ok: false, code: "FORBIDDEN", message: "Forbidden" };

beforeEach(() => {
  getSession.mockReset();
  readInviteLinkToken.mockReset();
  writes.length = 0;
  for (const [name, method] of Object.entries(store)) {
    method.mockReset();
    // Every row write is recorded, so a read-only path can be proven by absence;
    // the pair lock is serialization, not a write.
    if (
      name !== "findOwnerByToken" &&
      name !== "hasBlockBetween" &&
      name !== "findFriendship" &&
      name !== "lockPair"
    ) {
      method.mockImplementation(async () => {
        writes.push(name);
      });
    }
  }

  getSession.mockResolvedValue(session);
  readInviteLinkToken.mockResolvedValue("cu2token");
  store.findOwnerByToken.mockResolvedValue(anna);
  store.hasBlockBetween.mockResolvedValue(false);
  store.findFriendship.mockResolvedValue(false);
  store.transaction.mockImplementation((work: (tx: typeof store) => Promise<unknown>) =>
    work(store),
  );
});

describe("getMyInviteLink (Story 4.7)", () => {
  it("answers 401 without a session and never issues a token", async () => {
    getSession.mockResolvedValue(null);

    await expect(getMyInviteLink(new Headers())).resolves.toEqual(unauthenticated);
    expect(readInviteLinkToken).not.toHaveBeenCalled();
  });

  it("returns the session user's stored token and carries nothing else", async () => {
    await expect(getMyInviteLink(new Headers())).resolves.toEqual({
      ok: true,
      data: { token: "cu2token" },
    });
    expect(readInviteLinkToken).toHaveBeenCalledWith(viewer.id);
  });
});

describe("getInvitePreview (Story 4.7)", () => {
  it("answers a guest with the two public inviter fields and no state", async () => {
    getSession.mockResolvedValue(null);

    const result = await getInvitePreview("cu2token", new Headers());

    expect(result).toEqual({
      ok: true,
      data: { inviter: { displayName: "Анна", nick: "anna" } },
    });
    expect(JSON.stringify(result)).not.toContain("state");
    expect(JSON.stringify(result)).not.toContain(anna.id);
  });

  it("treats a malformed segment as not found before any read", async () => {
    getSession.mockResolvedValue(null);

    for (const token of ["", ".", "..", "a/b", "a\\b", "%2f", "x".repeat(129)]) {
      await expect(getInvitePreview(token, new Headers()), token).resolves.toEqual(notFound);
    }
    expect(store.findOwnerByToken).not.toHaveBeenCalled();
  });

  it("carries the closed viewer state for a signed-in viewer", async () => {
    const cases = [
      { viewerId: anna.id, blocked: false, friends: false, state: "self" },
      { viewerId: viewer.id, blocked: false, friends: true, state: "friends" },
      { viewerId: viewer.id, blocked: false, friends: false, state: "can_accept" },
    ] as const;

    for (const item of cases) {
      getSession.mockResolvedValue({ user: { id: item.viewerId }, session: {} });
      store.hasBlockBetween.mockResolvedValue(item.blocked);
      store.findFriendship.mockResolvedValue(item.friends);

      await expect(getInvitePreview("cu2token", new Headers()), item.state).resolves.toEqual({
        ok: true,
        data: { inviter: { displayName: "Анна", nick: "anna" }, state: item.state },
      });
    }
  });

  it("answers an unknown token and a Block in either direction with one body", async () => {
    store.findOwnerByToken.mockResolvedValue(null);
    const unknown = await getInvitePreview("cu2token", new Headers());

    store.findOwnerByToken.mockResolvedValue(anna);
    store.hasBlockBetween.mockResolvedValue(true);
    const blocked = await getInvitePreview("cu2token", new Headers());

    expect(unknown).toEqual(notFound);
    expect(blocked).toEqual(notFound);
    expect(store.hasBlockBetween).toHaveBeenCalledWith(viewer.id, anna.id);
    expect(JSON.stringify(blocked)).not.toContain("Анна");
  });

  it("writes nothing: the read-only path never opens a transaction", async () => {
    await getInvitePreview("cu2token", new Headers());

    getSession.mockResolvedValue(null);
    await getInvitePreview("cu2token", new Headers());

    expect(store.transaction).not.toHaveBeenCalled();
    expect(readInviteLinkToken).not.toHaveBeenCalled();
    expect(writes).toEqual([]);
  });
});

describe("acceptInviteByToken (Story 4.7)", () => {
  it("answers 401 without a session and never reaches the domain", async () => {
    getSession.mockResolvedValue(null);

    await expect(acceptInviteByToken("cu2token", new Headers())).resolves.toEqual(
      unauthenticated,
    );
    expect(store.transaction).not.toHaveBeenCalled();
  });

  it("does not open a transaction for a malformed segment", async () => {
    for (const token of ["", "..", "a/b", "%2f"]) {
      await expect(acceptInviteByToken(token, new Headers()), token).resolves.toEqual(notFound);
    }
    expect(store.transaction).not.toHaveBeenCalled();
  });

  it("refuses the viewer's own link with FORBIDDEN without a reason", async () => {
    getSession.mockResolvedValue({ user: { id: anna.id }, session: {} });

    const result = await acceptInviteByToken("cu2token", new Headers());

    expect(result).toEqual(forbidden);
    expect(result).not.toHaveProperty("reason");
    expect(writes).toEqual([]);
  });

  it("creates the edge once and answers FRIENDS", async () => {
    const result = await acceptInviteByToken("cu2token", new Headers());

    expect(result).toEqual({ ok: true, data: { outcome: "FRIENDS" } });
    expect(writes).toContain("createFriendship");
    expect(writes).toContain("deleteInvitesBetween");
  });

  it("is idempotent: ALREADY_FRIENDS is 200 and writes nothing", async () => {
    store.findFriendship.mockResolvedValue(true);

    await expect(acceptInviteByToken("cu2token", new Headers())).resolves.toEqual({
      ok: true,
      data: { outcome: "ALREADY_FRIENDS" },
    });
    expect(writes).toEqual([]);
  });

  it("answers an unknown token and a Block in either direction with one body", async () => {
    store.findOwnerByToken.mockResolvedValue(null);
    const unknown = await acceptInviteByToken("cu2token", new Headers());

    store.findOwnerByToken.mockResolvedValue(anna);
    store.hasBlockBetween.mockResolvedValue(true);
    const blocked = await acceptInviteByToken("cu2token", new Headers());

    expect(unknown).toEqual(notFound);
    expect(blocked).toEqual(notFound);
    expect(writes).toEqual([]);
  });});
