import { beforeEach, describe, expect, it, vi } from "vitest";
import { subscribeToNick, unsubscribeFromNick } from "@/api/subscription";

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock("@/api/client", () => api);

function answer(outcome: string) {
  return { ok: true, data: { outcome } };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("subscribeToNick", () => {
  it("POSTs the normalized nick to the subscription route and returns the outcome", async () => {
    api.apiRequest.mockResolvedValue(answer("SUBSCRIBED"));

    await expect(subscribeToNick(" AnyA ")).resolves.toEqual({
      ok: true,
      outcome: "SUBSCRIBED",
    });
    expect(api.apiRequest).toHaveBeenCalledWith("/api/v1/u/anya/subscription", {
      method: "POST",
    });
  });

  it("keeps the closed outcomes, including the successful repeat no-op", async () => {
    for (const outcome of ["SUBSCRIBED", "ALREADY_SUBSCRIBED"] as const) {
      api.apiRequest.mockResolvedValue(answer(outcome));
      await expect(subscribeToNick("anya")).resolves.toEqual({ ok: true, outcome });
    }
  });

  it("does not request a malformed segment", async () => {
    await expect(subscribeToNick("a/b")).resolves.toEqual({
      ok: false,
      invalid: true,
    });
    expect(api.apiRequest).not.toHaveBeenCalled();
  });

  it("rejects an answer outside the closed subscribe contract", async () => {
    api.apiRequest.mockResolvedValue(answer("UNSUBSCRIBED"));

    await expect(subscribeToNick("anya")).resolves.toEqual({
      ok: false,
      invalid: true,
    });
  });

  it("passes a transport error through", async () => {
    api.apiRequest.mockResolvedValue({ ok: false, network: true });

    await expect(subscribeToNick("anya")).resolves.toEqual({
      ok: false,
      network: true,
    });
  });

  it("passes an API refusal through untouched", async () => {
    api.apiRequest.mockResolvedValue({
      ok: false,
      code: "FORBIDDEN",
      message: "Forbidden",
    });

    await expect(subscribeToNick("anya")).resolves.toEqual({
      ok: false,
      code: "FORBIDDEN",
      message: "Forbidden",
    });
  });
});

describe("unsubscribeFromNick", () => {
  it("DELETEs the same subscription route and returns the outcome", async () => {
    api.apiRequest.mockResolvedValue(answer("UNSUBSCRIBED"));

    await expect(unsubscribeFromNick(" AnyA ")).resolves.toEqual({
      ok: true,
      outcome: "UNSUBSCRIBED",
    });
    expect(api.apiRequest).toHaveBeenCalledWith("/api/v1/u/anya/subscription", {
      method: "DELETE",
    });
  });

  it("keeps the closed removal outcomes, including the successful repeat no-op", async () => {
    for (const outcome of ["UNSUBSCRIBED", "NOT_SUBSCRIBED"] as const) {
      api.apiRequest.mockResolvedValue(answer(outcome));
      await expect(unsubscribeFromNick("anya")).resolves.toEqual({ ok: true, outcome });
    }
  });

  it("does not request a malformed segment", async () => {
    await expect(unsubscribeFromNick("a/b")).resolves.toEqual({
      ok: false,
      invalid: true,
    });
    expect(api.apiRequest).not.toHaveBeenCalled();
  });

  it("rejects an answer outside the closed removal contract", async () => {
    api.apiRequest.mockResolvedValue(answer("SUBSCRIBED"));

    await expect(unsubscribeFromNick("anya")).resolves.toEqual({
      ok: false,
      invalid: true,
    });
  });

  it("passes an API refusal through untouched", async () => {
    api.apiRequest.mockResolvedValue({
      ok: false,
      code: "NOT_FOUND",
      message: "Not found",
    });

    await expect(unsubscribeFromNick("anya")).resolves.toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Not found",
    });
  });
});
