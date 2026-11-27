import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  getSession,
  readPersonalDates,
  createPersonalDate,
  updatePersonalDate,
  deletePersonalDate,
} = vi.hoisted(() => ({
  getSession: vi.fn(),
  readPersonalDates: vi.fn(),
  createPersonalDate: vi.fn(),
  updatePersonalDate: vi.fn(),
  deletePersonalDate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/lib/personal-dates-store", () => ({
  readPersonalDates,
  createPersonalDate,
  updatePersonalDate,
  deletePersonalDate,
}));

import {
  createMyDate,
  deleteMyDate,
  listMyDates,
  updateMyDate,
} from "./personal-dates";

const headers = new Headers({ authorization: "Bearer t" });

const stored = {
  id: "d1",
  kind: "CUSTOM" as const,
  title: "Годовщина",
  day: 14,
  month: 6,
  year: 2020,
  visibility: "FRIENDS" as const,
  yearVisibility: "ONLY_ME" as const,
  ownerId: "u1",
};

const own = {
  id: "d1",
  kind: "CUSTOM",
  title: "Годовщина",
  day: 14,
  month: 6,
  year: 2020,
  visibility: "FRIENDS",
  yearVisibility: "ONLY_ME",
};

const createInput = {
  title: "Годовщина",
  day: 14,
  month: 6,
  year: 2020,
  visibility: "FRIENDS" as const,
  yearVisibility: "ONLY_ME" as const,
};

beforeEach(() => {
  getSession.mockReset();
  readPersonalDates.mockReset();
  createPersonalDate.mockReset();
  updatePersonalDate.mockReset();
  deletePersonalDate.mockReset();

  getSession.mockResolvedValue({ user: { id: "u1" }, session: { token: "t" } });
  readPersonalDates.mockResolvedValue([stored]);
  createPersonalDate.mockResolvedValue({ ok: true, date: stored });
  updatePersonalDate.mockResolvedValue({ ok: true, date: stored });
  deletePersonalDate.mockResolvedValue(true);
});

describe("GET /api/v1/me/dates — listMyDates", () => {
  it("answers every field of the owner's dates, switches included", async () => {
    await expect(listMyDates(headers)).resolves.toEqual({ ok: true, data: [own] });
    expect(readPersonalDates).toHaveBeenCalledWith("u1");
    expect(getSession).toHaveBeenCalledWith({ headers });
  });

  it("answers UNAUTHENTICATED without a session", async () => {
    getSession.mockResolvedValue(null);

    await expect(listMyDates(headers)).resolves.toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
    expect(readPersonalDates).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/me/dates — createMyDate", () => {
  it("answers the created row", async () => {
    await expect(createMyDate(headers, createInput)).resolves.toEqual({ ok: true, data: own });
    expect(createPersonalDate).toHaveBeenCalledWith("u1", createInput);
  });

  it("answers VALIDATION DATES_LIMIT on the eleventh date", async () => {
    createPersonalDate.mockResolvedValue({ ok: false, reason: "limit" });

    await expect(createMyDate(headers, createInput)).resolves.toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      reason: "DATES_LIMIT",
    });
  });

  it("answers UNAUTHENTICATED without a session", async () => {
    getSession.mockResolvedValue(null);

    await expect(createMyDate(headers, createInput)).resolves.toMatchObject({
      ok: false,
      code: "UNAUTHENTICATED",
    });
    expect(createPersonalDate).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/v1/me/dates/:id — updateMyDate", () => {
  it("answers the updated row", async () => {
    await expect(updateMyDate(headers, "d1", { title: "Новая" })).resolves.toEqual({
      ok: true,
      data: own,
    });
    expect(updatePersonalDate).toHaveBeenCalledWith("u1", "d1", { title: "Новая" });
  });

  it("answers the closed NOT_FOUND for a foreign or unknown id", async () => {
    updatePersonalDate.mockResolvedValue({ ok: false, reason: "not-found" });

    await expect(updateMyDate(headers, "d9", { title: "Новая" })).resolves.toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Date not found",
    });
  });

  it("names the day field when the merged calendar date is impossible", async () => {
    updatePersonalDate.mockResolvedValue({ ok: false, reason: "invalid", field: "day" });

    await expect(updateMyDate(headers, "d1", { year: 2023 })).resolves.toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: "day",
    });
  });

  it("answers UNAUTHENTICATED without a session", async () => {
    getSession.mockResolvedValue(null);

    await expect(updateMyDate(headers, "d1", { title: "Новая" })).resolves.toMatchObject({
      ok: false,
      code: "UNAUTHENTICATED",
    });
    expect(updatePersonalDate).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/v1/me/dates/:id — deleteMyDate", () => {
  it("answers the deleted id", async () => {
    await expect(deleteMyDate(headers, "d1")).resolves.toEqual({ ok: true, data: { id: "d1" } });
    expect(deletePersonalDate).toHaveBeenCalledWith("u1", "d1");
  });

  it("answers NOT_FOUND when the row is foreign or already gone", async () => {
    deletePersonalDate.mockResolvedValue(false);

    await expect(deleteMyDate(headers, "d9")).resolves.toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Date not found",
    });
  });

  it("answers UNAUTHENTICATED without a session", async () => {
    getSession.mockResolvedValue(null);

    await expect(deleteMyDate(headers, "d1")).resolves.toMatchObject({
      ok: false,
      code: "UNAUTHENTICATED",
    });
    expect(deletePersonalDate).not.toHaveBeenCalled();
  });
});
