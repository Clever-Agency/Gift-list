import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, findUnique, update } = vi.hoisted(() => ({
  getSession: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({ prisma: { user: { findUnique, update } } }));

import { updateHideFromSearch } from "./update-hide-from-search";

const headers = new Headers();

const row = {
  id: "u1",
  email: "a@example.com",
  name: "Анна",
  nick: "anna",
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

describe("updateHideFromSearch", () => {
  it("requires a session", async () => {
    getSession.mockResolvedValue(null);
    expect(await updateHideFromSearch({ hideFromSearch: true }, headers)).toMatchObject({
      ok: false,
      code: "UNAUTHENTICATED",
    });
    expect(findUnique).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("answers UNAUTHENTICATED when the user row is gone", async () => {
    findUnique.mockResolvedValue(null);
    expect(await updateHideFromSearch({ hideFromSearch: true }, headers)).toMatchObject({
      ok: false,
      code: "UNAUTHENTICATED",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("stores the flag and returns the full updated user", async () => {
    const result = await updateHideFromSearch({ hideFromSearch: true }, headers);

    expect(update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { hideFromSearch: true },
    });
    expect(result).toEqual({
      ok: true,
      data: {
        id: "u1",
        email: "a@example.com",
        name: "Анна",
        nick: "anna",
        timeZone: null,
        hideFromSearch: true,
      },
    });
  });

  it("turns the flag off again and keeps the stored time zone", async () => {
    findUnique.mockResolvedValue({ ...row, timeZone: "Europe/Minsk", hideFromSearch: true });

    const result = await updateHideFromSearch({ hideFromSearch: false }, headers);

    expect(update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { hideFromSearch: false },
    });
    expect(result).toMatchObject({
      ok: true,
      data: { timeZone: "Europe/Minsk", hideFromSearch: false },
    });
  });

  it("does not write when the flag already has the requested value", async () => {
    const result = await updateHideFromSearch({ hideFromSearch: false }, headers);

    expect(result).toEqual({
      ok: true,
      data: {
        id: "u1",
        email: "a@example.com",
        name: "Анна",
        nick: "anna",
        timeZone: null,
        hideFromSearch: false,
      },
    });
    expect(update).not.toHaveBeenCalled();
  });
});
