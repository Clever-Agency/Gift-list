import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, findUnique, update } = vi.hoisted(() => ({
  getSession: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({ prisma: { user: { findUnique, update } } }));

import { changeTimeZone, setTimeZone } from "./set-time-zone";

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

describe("changeTimeZone", () => {
  it("overwrites a stored zone with the explicit choice", async () => {
    findUnique.mockResolvedValue({ id: "u1" });
    const result = await changeTimeZone({ timeZone: "Europe/Minsk" }, headers);
    expect(result).toEqual({ ok: true, data: { timeZone: "Europe/Minsk" } });
    expect(update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { timeZone: "Europe/Minsk" },
    });
  });

  it("overwrites even when the stored zone is UTC", async () => {
    findUnique.mockResolvedValue({ id: "u1" });
    const result = await changeTimeZone({ timeZone: "Asia/Tokyo" }, headers);
    expect(result).toEqual({ ok: true, data: { timeZone: "Asia/Tokyo" } });
    expect(update).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{}],
    [{ timeZone: "" }],
    [{ timeZone: "Not/AZone" }],
    [{ timeZone: 42 }],
  ])("answers VALIDATION on timeZone for %j", async (body) => {
    const result = await changeTimeZone(body as { timeZone?: string }, headers);
    expect(result).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: "timeZone",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("requires a session", async () => {
    getSession.mockResolvedValue(null);
    expect(await changeTimeZone({ timeZone: "UTC" }, headers)).toMatchObject({
      ok: false,
      code: "UNAUTHENTICATED",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("answers UNAUTHENTICATED when the user row is gone", async () => {
    findUnique.mockResolvedValue(null);
    expect(await changeTimeZone({ timeZone: "UTC" }, headers)).toMatchObject({
      ok: false,
      code: "UNAUTHENTICATED",
    });
    expect(update).not.toHaveBeenCalled();
  });
});
