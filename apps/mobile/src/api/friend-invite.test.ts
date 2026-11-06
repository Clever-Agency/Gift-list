import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendFriendInvite } from "@/api/friend-invite";

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
