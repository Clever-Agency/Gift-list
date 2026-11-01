import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, findUnique, update } = vi.hoisted(() => ({
  getSession: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({ prisma: { user: { findUnique, update } } }));

import { setTimeZone } from "./set-time-zone";

const headers = new Headers();

beforeEach(() => {
  getSession.mockReset();
  findUnique.mockReset();
  update.mockReset();
  getSession.mockResolvedValue({ user: { id: "u1" }, session: { token: "t" } });
  update.mockResolvedValue({});
});

describe("setTimeZone", () => {
  it("stores a valid IANA zone when none is set", async () => {
    findUnique.mockResolvedValue({ timeZone: null });
    const result = await setTimeZone({ timeZone: "Europe/Minsk" }, headers);
    expect(result).toEqual({ ok: true, data: { timeZone: "Europe/Minsk" } });
    expect(update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { timeZone: "Europe/Minsk" },
    });
  });

  it("stores UTC for an empty or unknown zone", async () => {
    findUnique.mockResolvedValue({ timeZone: null });
    expect(await setTimeZone({}, headers)).toEqual({ ok: true, data: { timeZone: "UTC" } });
    expect(await setTimeZone({ timeZone: "Not/AZone" }, headers)).toEqual({
      ok: true,
      data: { timeZone: "UTC" },
    });
  });

  it("does not overwrite a zone that is already stored", async () => {
    findUnique.mockResolvedValue({ timeZone: "UTC" });
    const result = await setTimeZone({ timeZone: "Europe/Minsk" }, headers);
    expect(result).toEqual({ ok: true, data: { timeZone: "UTC" } });
    expect(update).not.toHaveBeenCalled();
  });

  it("requires a session", async () => {
    getSession.mockResolvedValue(null);
    expect(await setTimeZone({ timeZone: "UTC" }, headers)).toMatchObject({
      ok: false,
      code: "UNAUTHENTICATED",
    });
  });
});
