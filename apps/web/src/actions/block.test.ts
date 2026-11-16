import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, findUser, blockUser, unblockUser, readBlockedPage, store, reader } =
  vi.hoisted(() => ({
    getSession: vi.fn(),
    findUser: vi.fn(),
    blockUser: vi.fn(),
    unblockUser: vi.fn(),
    readBlockedPage: vi.fn(),
    store: { transaction: vi.fn() },
    reader: { readBlockedPeople: vi.fn() },
  }));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({ prisma: { user: { findUnique: findUser } } }));
vi.mock("@/lib/friendship-store", () => ({
  friendshipStore: store,
  blockedPeopleReader: reader,
}));
vi.mock("@/domain/block", () => ({ blockUser, unblockUser, readBlockedPage }));

import { blockUserByNick, listBlocked, unblockUserByNick } from "./block";

const anna = { id: "u1", nickNormalized: "anna" };
const users = [anna];

const session = { user: { id: "u9" }, session: {} };

const annaBlock = {
  id: anna.id,
  displayName: "Анна",
  nick: "anna",
  blockedAt: new Date("2026-11-16T10:00:00.000Z"),
};

const unauthenticated = {
  ok: false,
  code: "UNAUTHENTICATED",
  message: "Authentication required",
};

const notFound = { ok: false, code: "NOT_FOUND", message: "Not found" };

beforeEach(() => {
  getSession.mockReset();
  findUser.mockReset();
  blockUser.mockReset();
  unblockUser.mockReset();
  readBlockedPage.mockReset();
  store.transaction.mockReset();

  getSession.mockResolvedValue(session);
  findUser.mockImplementation(({ where }: { where: { nickNormalized: string } }) =>
    Promise.resolve(users.find((user) => user.nickNormalized === where.nickNormalized) ?? null),
  );
  blockUser.mockResolvedValue({ ok: true, outcome: "BLOCKED" });
  unblockUser.mockResolvedValue({ ok: true, outcome: "UNBLOCKED" });
  readBlockedPage.mockResolvedValue({
    ok: true,
    items: [annaBlock],
    nextCursor: null,
    total: 1,
  });
});

describe("block/unblock/listBlocked without a session", () => {
  it("answer UNAUTHENTICATED and never resolve a nick or touch the domain", async () => {
    getSession.mockResolvedValue(null);

    await expect(blockUserByNick("anna", new Headers())).resolves.toEqual(unauthenticated);
    await expect(unblockUserByNick("anna", new Headers())).resolves.toEqual(unauthenticated);
    await expect(listBlocked({}, new Headers())).resolves.toEqual(unauthenticated);

    expect(findUser).not.toHaveBeenCalled();
    expect(blockUser).not.toHaveBeenCalled();
    expect(unblockUser).not.toHaveBeenCalled();
    expect(readBlockedPage).not.toHaveBeenCalled();
  });
});

describe("blockUserByNick (Story 4.5)", () => {
  it("treats a malformed or unknown nick as the same NOT_FOUND", async () => {
    for (const nick of ["", "ab", "a/b", "anna!", "x".repeat(25), "no-such-nick"]) {
      await expect(blockUserByNick(nick, new Headers()), nick).resolves.toEqual(notFound);
    }

    expect(blockUser).not.toHaveBeenCalled();
  });

  it("blocks with the session user as the actor and the nick as the other side", async () => {
    const result = await blockUserByNick("AnNa", new Headers());

    expect(result).toEqual({ ok: true, data: { outcome: "BLOCKED" } });
    expect(findUser).toHaveBeenCalledWith({
      where: { nickNormalized: "anna" },
      select: { id: true },
    });
    expect(blockUser).toHaveBeenCalledWith({ viewerId: "u9", otherUserId: "u1" }, store);
  });

  it.each(["BLOCKED", "ALREADY_BLOCKED"] as const)(
    "returns the closed block outcome %s as a success",
    async (outcome) => {
      blockUser.mockResolvedValue({ ok: true, outcome });

      await expect(blockUserByNick("anna", new Headers())).resolves.toEqual({
        ok: true,
        data: { outcome },
      });
    },
  );

  it("maps a self pair to FORBIDDEN without a reason", async () => {
    getSession.mockResolvedValue({ user: { id: anna.id }, session: {} });
    blockUser.mockResolvedValue({ ok: false, code: "FORBIDDEN" });

    const result = await blockUserByNick("anna", new Headers());

    expect(blockUser).toHaveBeenCalledWith(
      { viewerId: anna.id, otherUserId: anna.id },
      store,
    );
    expect(result).toEqual({ ok: false, code: "FORBIDDEN", message: "Forbidden" });
    expect(result).not.toHaveProperty("reason");
    expect(result).not.toHaveProperty("params");
  });

  it("never says that the other side blocked first: one outcome, nothing else", async () => {
    blockUser.mockResolvedValue({ ok: true, outcome: "BLOCKED" });
    const first = await blockUserByNick("anna", new Headers());

    // A mutual block inserts the same directed row, so the domain answers the
    // same success and the action has no reverse row to report.
    blockUser.mockResolvedValue({ ok: true, outcome: "BLOCKED" });
    const mutual = await blockUserByNick("anna", new Headers());

    expect(first).toEqual(mutual);
    expect(first.ok && Object.keys(first.data)).toEqual(["outcome"]);
    const serialized = JSON.stringify(mutual);
    for (const leak of ["blockedBy", "mutual", "reverse", "blockedAt", "anna@"]) {
      expect(serialized).not.toContain(leak);
    }
  });

  it("never returns an email, name or token", async () => {
    const serialized = JSON.stringify(await blockUserByNick("anna", new Headers()));

    expect(serialized).not.toContain("anna@example.com");
    expect(serialized).not.toContain("Анна");
    expect(serialized).not.toContain("publicToken");
  });

  it("passes the request headers to the session lookup", async () => {
    const headers = new Headers({ authorization: "Bearer t" });

    await blockUserByNick("anna", headers);

    expect(getSession).toHaveBeenCalledWith({ headers });
  });
});

describe("unblockUserByNick (Story 4.5)", () => {
  it("unblocks with the session user as the actor and the nick as the other side", async () => {
    const result = await unblockUserByNick("AnNa", new Headers());

    expect(result).toEqual({ ok: true, data: { outcome: "UNBLOCKED" } });
    expect(unblockUser).toHaveBeenCalledWith({ viewerId: "u9", otherUserId: "u1" }, store);
    expect(findUser).toHaveBeenCalledWith({
      where: { nickNormalized: "anna" },
      select: { id: true },
    });
  });

  it.each(["UNBLOCKED", "NOT_BLOCKED"] as const)(
    "returns the closed unblock outcome %s as a success",
    async (outcome) => {
      unblockUser.mockResolvedValue({ ok: true, outcome });

      await expect(unblockUserByNick("anna", new Headers())).resolves.toEqual({
        ok: true,
        data: { outcome },
      });
    },
  );

  it("does not need the profile gate: a blocked person is resolved by nick directly", async () => {
    // After a block `/u/:nick` answers `not_found` in both directions; the
    // unblock still has to reach the person, so only the nick lookup runs.
    blockUser.mockResolvedValue({ ok: true, outcome: "BLOCKED" });

    const result = await unblockUserByNick("anna", new Headers());

    expect(result).toEqual({ ok: true, data: { outcome: "UNBLOCKED" } });
    expect(unblockUser).toHaveBeenCalledTimes(1);
  });

  it("maps a self pair and an unknown nick of the other side to the closed refusals", async () => {
    getSession.mockResolvedValue({ user: { id: anna.id }, session: {} });
    unblockUser.mockResolvedValue({ ok: false, code: "FORBIDDEN" });

    await expect(unblockUserByNick("anna", new Headers())).resolves.toEqual({
      ok: false,
      code: "FORBIDDEN",
      message: "Forbidden",
    });
    await expect(unblockUserByNick("unknown", new Headers())).resolves.toEqual(notFound);
  });
});

describe("listBlocked (Story 4.5.2)", () => {
  it("reads the viewer's own blocks through the domain page", async () => {
    const result = await listBlocked({}, new Headers());

    expect(readBlockedPage).toHaveBeenCalledWith(reader, { viewerId: "u9", cursor: undefined });
    expect(result).toEqual({
      ok: true,
      data: { items: [{ displayName: "Анна", nick: "anna" }], nextCursor: null, total: 1 },
    });
  });

  it("drops the internal id and the block time of the row", async () => {
    const serialized = JSON.stringify(await listBlocked({}, new Headers()));

    expect(serialized).not.toContain(`"id"`);
    expect(serialized).not.toContain("blockedAt");
    expect(serialized).not.toContain("2026-11-16");
    expect(serialized).not.toContain("anna@example.com");
  });

  it("passes the opaque cursor of the previous page and its own page back", async () => {
    readBlockedPage.mockResolvedValue({
      ok: true,
      items: [annaBlock],
      nextCursor: "1763287200000|cu2",
      total: 16,
    });

    const result = await listBlocked({ cursor: "1763287200000|cu1" }, new Headers());

    expect(readBlockedPage).toHaveBeenCalledWith(reader, {
      viewerId: "u9",
      cursor: "1763287200000|cu1",
    });
    expect(result.ok && result.data.nextCursor).toBe("1763287200000|cu2");
    expect(result.ok && result.data.total).toBe(16);
  });

  it("maps a cursor the domain did not issue to VALIDATION on the cursor field", async () => {
    readBlockedPage.mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      reason: "INVALID_CURSOR",
    });

    await expect(listBlocked({ cursor: "мусор" }, new Headers())).resolves.toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid cursor",
      field: "cursor",
    });
  });

  it("answers an empty list as an empty page, not as an error", async () => {
    readBlockedPage.mockResolvedValue({ ok: true, items: [], nextCursor: null, total: 0 });

    await expect(listBlocked({}, new Headers())).resolves.toEqual({
      ok: true,
      data: { items: [], nextCursor: null, total: 0 },
    });
  });
});
