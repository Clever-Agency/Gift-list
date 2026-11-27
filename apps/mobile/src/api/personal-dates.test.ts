import type { PersonalDate } from "@gift-list/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMyDate,
  deleteMyDate,
  listMyDates,
  updateMyDate,
} from "@/api/personal-dates";

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock("@/api/client", () => api);

const stored: PersonalDate = {
  id: "d1",
  kind: "CUSTOM",
  title: "Годовщина свадьбы",
  day: 14,
  month: 3,
  year: null,
  visibility: "FRIENDS",
  yearVisibility: "ONLY_ME",
};

const body = {
  title: "Годовщина свадьбы",
  day: 14,
  month: 3,
  year: null,
  visibility: "FRIENDS" as const,
  yearVisibility: "ONLY_ME" as const,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("listMyDates", () => {
  it("GETs /api/v1/me/dates and returns every stored field", async () => {
    api.apiRequest.mockResolvedValue({ ok: true, data: [stored] });

    await expect(listMyDates()).resolves.toEqual({ ok: true, data: [stored] });
    expect(api.apiRequest).toHaveBeenCalledWith("/api/v1/me/dates");
  });

  it("rejects a body that is not an array of dates", async () => {
    api.apiRequest.mockResolvedValue({ ok: true, data: { dates: [] } });

    await expect(listMyDates()).resolves.toEqual({ ok: false, invalid: true });
  });

  it("rejects a row outside the owner contract", async () => {
    api.apiRequest.mockResolvedValue({
      ok: true,
      data: [{ ...stored, visibility: undefined }],
    });

    await expect(listMyDates()).resolves.toEqual({ ok: false, invalid: true });
  });

  it("passes the transport error through", async () => {
    api.apiRequest.mockResolvedValue({ ok: false, network: true });

    await expect(listMyDates()).resolves.toEqual({ ok: false, network: true });
  });
});

describe("createMyDate", () => {
  it("POSTs the body and returns the created row", async () => {
    api.apiRequest.mockResolvedValue({ ok: true, data: stored });

    await expect(createMyDate(body)).resolves.toEqual({ ok: true, data: stored });
    expect(api.apiRequest).toHaveBeenCalledWith("/api/v1/me/dates", {
      method: "POST",
      body,
    });
  });

  it("keeps the DATES_LIMIT refusal of the server", async () => {
    const refusal = {
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      reason: "DATES_LIMIT",
    };
    api.apiRequest.mockResolvedValue(refusal);

    await expect(createMyDate(body)).resolves.toEqual(refusal);
  });

  it("rejects a created row outside the contract", async () => {
    api.apiRequest.mockResolvedValue({ ok: true, data: { ...stored, kind: "BIRTHDAY" } });

    await expect(createMyDate(body)).resolves.toEqual({ ok: false, invalid: true });
  });
});

describe("updateMyDate", () => {
  it("PATCHes one own date by the encoded id", async () => {
    api.apiRequest.mockResolvedValue({ ok: true, data: stored });

    await expect(updateMyDate("d 1", { title: "Новая дата" })).resolves.toEqual({
      ok: true,
      data: stored,
    });
    expect(api.apiRequest).toHaveBeenCalledWith("/api/v1/me/dates/d%201", {
      method: "PATCH",
      body: { title: "Новая дата" },
    });
  });

  it("keeps the field of a validation refusal", async () => {
    const refusal = {
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: "day",
    };
    api.apiRequest.mockResolvedValue(refusal);

    await expect(updateMyDate("d1", { year: 2023 })).resolves.toEqual(refusal);
  });
});

describe("deleteMyDate", () => {
  it("DELETEs the date and accepts the answer with the same id", async () => {
    api.apiRequest.mockResolvedValue({ ok: true, data: { id: "d 1" } });

    await expect(deleteMyDate("d 1")).resolves.toEqual({ ok: true });
    expect(api.apiRequest).toHaveBeenCalledWith("/api/v1/me/dates/d%201", {
      method: "DELETE",
    });
  });

  it("rejects an answer that names another row", async () => {
    api.apiRequest.mockResolvedValue({ ok: true, data: { id: "d2" } });

    await expect(deleteMyDate("d1")).resolves.toEqual({ ok: false, invalid: true });
  });
});
