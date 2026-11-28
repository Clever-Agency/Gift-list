import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, findUnique, update } = vi.hoisted(() => ({
  getSession: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({ prisma: { user: { findUnique, update } } }));

import { updateName } from "./update-name";

const headers = new Headers();

const row = {
  id: "u1",
  email: "a@example.com",
  name: "Аня",
  nick: "anya",
  timeZone: null as string | null,
  hideFromSearch: false,
};

beforeEach(() => {
  getSession.mockReset();
  findUnique.mockReset();
  update.mockReset();
  getSession.mockResolvedValue({ user: { id: "u1" }, session: { token: "t" } });
  findUnique.mockResolvedValue(row);
  update.mockResolvedValue({});
});

describe("updateName", () => {
  it("requires a session", async () => {
    getSession.mockResolvedValue(null);

    expect(await updateName({ name: "Анна" }, headers)).toMatchObject({
      ok: false,
      code: "UNAUTHENTICATED",
    });
    expect(findUnique).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("answers UNAUTHENTICATED when the user row is gone", async () => {
    findUnique.mockResolvedValue(null);

    expect(await updateName({ name: "Анна" }, headers)).toMatchObject({
      ok: false,
      code: "UNAUTHENTICATED",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("stores the name with its search key and returns the updated user", async () => {
    const result = await updateName({ name: "Анна Ковалёва" }, headers);

    // AD-27: the search reads `nameNormalized`, so the two columns are written together.
    expect(update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { name: "Анна Ковалёва", nameNormalized: "анна ковалева" },
    });
    expect(result).toEqual({
      ok: true,
      data: {
        id: "u1",
        email: "a@example.com",
        name: "Анна Ковалёва",
        nick: "anya",
        timeZone: null,
        hideFromSearch: false,
      },
    });
  });

  it("trims the value and folds ё in the search key", async () => {
    await updateName({ name: "  Алёна  " }, headers);

    expect(update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { name: "Алёна", nameNormalized: "алена" },
    });
  });

  it("does not write when the name is already the user's own", async () => {
    const result = await updateName({ name: " Аня " }, headers);

    expect(result).toEqual({
      ok: true,
      data: {
        id: "u1",
        email: "a@example.com",
        name: "Аня",
        nick: "anya",
        timeZone: null,
        hideFromSearch: false,
      },
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("keeps a stored time zone in the answer", async () => {
    findUnique.mockResolvedValue({ ...row, timeZone: "Europe/Minsk" });

    const result = await updateName({ name: "Анна" }, headers);

    expect(result).toMatchObject({ ok: true, data: { timeZone: "Europe/Minsk" } });
  });
});
