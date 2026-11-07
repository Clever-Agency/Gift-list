import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  acceptFriendInvite,
  rejectFriendInvite,
  sendFriendInvite,
} from "@/api/friend-invite";

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock("@/api/client", () => api);

function answer(outcome: string) {
  return { ok: true, data: { outcome } };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("sendFriendInvite", () => {
  it("POSTs the normalized nick to the same invite route and returns the outcome", async () => {
    api.apiRequest.mockResolvedValue(answer("INVITED"));

    await expect(sendFriendInvite(" AnyA ")).resolves.toEqual({
      ok: true,
      outcome: "INVITED",
    });
    expect(api.apiRequest).toHaveBeenCalledWith("/api/v1/u/anya/invite", {
      method: "POST",
    });
  });

  it("keeps the closed outcomes of 4.1.1, including successful no-ops", async () => {
    for (const outcome of [
      "INVITED",
      "PENDING",
      "ALREADY_FRIENDS",
      "FRIENDS_CREATED",
    ] as const) {
      api.apiRequest.mockResolvedValue(answer(outcome));
      await expect(sendFriendInvite("anya")).resolves.toEqual({ ok: true, outcome });
    }
  });

  it("does not request a malformed segment", async () => {
    await expect(sendFriendInvite("a/b")).resolves.toEqual({
      ok: false,
      invalid: true,
    });
    expect(api.apiRequest).not.toHaveBeenCalled();
  });

  it("rejects an answer outside the closed outcome contract", async () => {
    api.apiRequest.mockResolvedValue(answer("MAYBE"));

    await expect(sendFriendInvite("anya")).resolves.toEqual({
      ok: false,
      invalid: true,
    });
  });

  it("passes a transport error through", async () => {
    api.apiRequest.mockResolvedValue({ ok: false, network: true });

    await expect(sendFriendInvite("anya")).resolves.toEqual({
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

    await expect(sendFriendInvite("anya")).resolves.toEqual({
      ok: false,
      code: "FORBIDDEN",
      message: "Forbidden",
    });
  });
});

describe("acceptFriendInvite", () => {
  it("POSTs the normalized nick to the explicit accept route", async () => {
    api.apiRequest.mockResolvedValue(answer("FRIENDS_CREATED"));

    await expect(acceptFriendInvite(" AnyA ")).resolves.toEqual({
      ok: true,
      outcome: "FRIENDS_CREATED",
    });
    expect(api.apiRequest).toHaveBeenCalledWith("/api/v1/u/anya/invite/accept", {
      method: "POST",
    });
  });

  it("keeps only the closed accept outcomes", async () => {
    for (const outcome of ["FRIENDS_CREATED", "ALREADY_FRIENDS"] as const) {
      api.apiRequest.mockResolvedValue(answer(outcome));
      await expect(acceptFriendInvite("anya")).resolves.toEqual({ ok: true, outcome });
    }
  });

  it("does not request a malformed segment", async () => {
    await expect(acceptFriendInvite("a/b")).resolves.toEqual({
      ok: false,
      invalid: true,
    });
    expect(api.apiRequest).not.toHaveBeenCalled();
  });

  it("rejects an answer outside the accept contract", async () => {
    api.apiRequest.mockResolvedValue(answer("INVITED"));

    await expect(acceptFriendInvite("anya")).resolves.toEqual({
      ok: false,
      invalid: true,
    });
  });

  it("passes a transport error through", async () => {
    api.apiRequest.mockResolvedValue({ ok: false, network: true });

    await expect(acceptFriendInvite("anya")).resolves.toEqual({
      ok: false,
      network: true,
    });
  });
});

describe("rejectFriendInvite", () => {
  it("POSTs the normalized nick to the explicit reject route", async () => {
    api.apiRequest.mockResolvedValue(answer("REJECTED"));

    await expect(rejectFriendInvite(" AnyA ")).resolves.toEqual({
      ok: true,
      outcome: "REJECTED",
    });
    expect(api.apiRequest).toHaveBeenCalledWith("/api/v1/u/anya/invite/reject", {
      method: "POST",
    });
  });

  it("does not request a malformed segment", async () => {
    await expect(rejectFriendInvite("a/b")).resolves.toEqual({
      ok: false,
      invalid: true,
    });
    expect(api.apiRequest).not.toHaveBeenCalled();
  });

  it("rejects an answer outside the reject contract", async () => {
    api.apiRequest.mockResolvedValue(answer("FRIENDS_CREATED"));

    await expect(rejectFriendInvite("anya")).resolves.toEqual({
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

    await expect(rejectFriendInvite("anya")).resolves.toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Not found",
    });
  });
});
