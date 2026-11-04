import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, findUnique, findFirst, update, PrismaClientKnownRequestError } = vi.hoisted(() => {
  class PrismaClientKnownRequestError extends Error {
    constructor(readonly code: string) {
      super(code);
    }
  }
  return {
    getSession: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    PrismaClientKnownRequestError,
  };
});

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
// No `list` delegate: touching the list table would throw, so an update can
// never rewrite `List.publicToken` (AD-6, A-26).
vi.mock("@/db/client", () => ({ prisma: { user: { findUnique, findFirst, update } } }));
vi.mock("@/db/generated/client", () => ({ Prisma: { PrismaClientKnownRequestError } }));

import { updateNick } from "./update-nick";

const headers = new Headers();

const row = {
  id: "u1",
  email: "a@example.com",
  name: "Анна",
  nick: "anna",
  nickNormalized: "anna",
  timeZone: null as string | null,
};

beforeEach(() => {
  getSession.mockReset();
  findUnique.mockReset();
  findFirst.mockReset();
  update.mockReset();
  getSession.mockResolvedValue({ user: { id: "u1" }, session: { token: "t" } });
  findUnique.mockResolvedValue(row);
  findFirst.mockResolvedValue(null);
  update.mockResolvedValue({});
});

describe("updateNick", () => {
  it("requires a session", async () => {
    getSession.mockResolvedValue(null);
    expect(await updateNick({ nick: "newnick" }, headers)).toMatchObject({
      ok: false,
      code: "UNAUTHENTICATED",
    });
    expect(findUnique).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("answers UNAUTHENTICATED when the user row is gone", async () => {
    findUnique.mockResolvedValue(null);
    expect(await updateNick({ nick: "newnick" }, headers)).toMatchObject({
      ok: false,
      code: "UNAUTHENTICATED",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("stores the nick and returns the updated user", async () => {
    const result = await updateNick({ nick: "newnick" }, headers);

    expect(update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { nick: "newnick", nickNormalized: "newnick" },
    });
    expect(result).toEqual({
      ok: true,
      data: {
        id: "u1",
        email: "a@example.com",
        name: "Анна",
        nick: "newnick",
        timeZone: null,
      },
    });
  });

  it("keeps a stored time zone in the answer", async () => {
    findUnique.mockResolvedValue({ ...row, timeZone: "Europe/Minsk" });
    const result = await updateNick({ nick: "newnick" }, headers);
    expect(result).toMatchObject({ ok: true, data: { timeZone: "Europe/Minsk" } });
  });

  it("does not write when the nick is already the user's own", async () => {
    const result = await updateNick({ nick: "anna" }, headers);

    expect(result).toEqual({
      ok: true,
      data: {
        id: "u1",
        email: "a@example.com",
        name: "Анна",
        nick: "anna",
        timeZone: null,
      },
    });
    expect(findFirst).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("answers NICK_TAKEN when another user holds the nick", async () => {
    findFirst.mockResolvedValue({ id: "u2" });
    const result = await updateNick({ nick: "newnick" }, headers);

    expect(findFirst).toHaveBeenCalledWith({
      where: { nickNormalized: "newnick", id: { not: "u1" } },
      select: { id: true },
    });
    expect(result).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Nick is taken",
      field: "nick",
      reason: "NICK_TAKEN",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("answers NICK_TAKEN when the update loses the race (P2002)", async () => {
    update.mockRejectedValue(new PrismaClientKnownRequestError("P2002"));
    expect(await updateNick({ nick: "newnick" }, headers)).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Nick is taken",
      field: "nick",
      reason: "NICK_TAKEN",
    });
  });
});
