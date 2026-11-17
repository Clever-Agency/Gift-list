import { beforeEach, describe, expect, it, vi } from "vitest";

import { blockUser, listBlocked, unblockUser } from "@/api/block";

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock("@/api/client", () => api);

const page = {
  items: [{ displayName: "Анна", nick: "anna" }],
  nextCursor: "1763287200000|cu2",
  total: 1,
};

function answer(data: unknown) {
  return { ok: true, data };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("blockUser", () => {
  it("POSTs the block segment of the normalized nick without a body", async () => {
    api.apiRequest.mockResolvedValue(answer({ outcome: "BLOCKED" }));

    await expect(blockUser(" AnyA ")).resolves.toEqual({ ok: true, outcome: "BLOCKED" });
    expect(api.apiRequest).toHaveBeenCalledWith("/api/v1/u/anya/block", { method: "POST" });
  });

  it("keeps the closed outcome set, including the successful repeat", async () => {
    api.apiRequest.mockResolvedValue(answer({ outcome: "ALREADY_BLOCKED" }));

    await expect(blockUser("anya")).resolves.toEqual({
      ok: true,
      outcome: "ALREADY_BLOCKED",
    });
  });

  it("does not request a malformed segment", async () => {
    await expect(blockUser("a/b")).resolves.toEqual({ ok: false, invalid: true });
    expect(api.apiRequest).not.toHaveBeenCalled();
  });

  it("passes a transport error and an API refusal through untouched", async () => {
    api.apiRequest.mockResolvedValueOnce({ ok: false, network: true });
    await expect(blockUser("anya")).resolves.toEqual({ ok: false, network: true });

    api.apiRequest.mockResolvedValueOnce({ ok: false, code: "FORBIDDEN", message: "" });
    await expect(blockUser("anya")).resolves.toEqual({
      ok: false,
      code: "FORBIDDEN",
      message: "",
    });
  });

  it("rejects an answer outside the block contract", async () => {
    api.apiRequest.mockResolvedValue(answer({ outcome: "UNBLOCKED" }));

    await expect(blockUser("anya")).resolves.toEqual({ ok: false, invalid: true });
  });
});

describe("unblockUser", () => {
  it("DELETEs the block segment of the normalized nick without a body", async () => {
    api.apiRequest.mockResolvedValue(answer({ outcome: "UNBLOCKED" }));

    await expect(unblockUser(" AnyA ")).resolves.toEqual({ ok: true, outcome: "UNBLOCKED" });
    expect(api.apiRequest).toHaveBeenCalledWith("/api/v1/u/anya/block", { method: "DELETE" });
  });

  it("keeps the successful repeat NOT_BLOCKED", async () => {
    api.apiRequest.mockResolvedValue(answer({ outcome: "NOT_BLOCKED" }));

    await expect(unblockUser("anya")).resolves.toEqual({ ok: true, outcome: "NOT_BLOCKED" });
  });

  it("does not request a malformed segment", async () => {
    await expect(unblockUser("../anna")).resolves.toEqual({ ok: false, invalid: true });
    expect(api.apiRequest).not.toHaveBeenCalled();
  });

  it("rejects an answer outside the unblock contract", async () => {
    api.apiRequest.mockResolvedValue(answer({ outcome: "BLOCKED" }));

    await expect(unblockUser("anya")).resolves.toEqual({ ok: false, invalid: true });
  });
});

describe("listBlocked", () => {
  it("GETs the first page without a query", async () => {
    api.apiRequest.mockResolvedValue(answer(page));

    await expect(listBlocked()).resolves.toEqual({ ok: true, page });
    expect(api.apiRequest).toHaveBeenCalledWith("/api/v1/me/blocks");
  });

  it("treats a blank cursor as the first page", async () => {
    api.apiRequest.mockResolvedValue(answer(page));

    await listBlocked("");

    expect(api.apiRequest).toHaveBeenCalledWith("/api/v1/me/blocks");
  });

  it("encodes and passes the opaque cursor back", async () => {
    api.apiRequest.mockResolvedValue(answer(page));

    await listBlocked("1763287200000|cu1");

    expect(api.apiRequest).toHaveBeenCalledWith(
      `/api/v1/me/blocks?cursor=${encodeURIComponent("1763287200000|cu1")}`,
    );
  });

  it("passes a transport error and the dead session through", async () => {
    api.apiRequest.mockResolvedValueOnce({ ok: false, network: true });
    await expect(listBlocked()).resolves.toEqual({ ok: false, network: true });

    api.apiRequest.mockResolvedValueOnce({ ok: false, code: "UNAUTHENTICATED", message: "" });
    await expect(listBlocked()).resolves.toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "",
    });
  });

  it("rejects a body outside the page contract", async () => {
    api.apiRequest.mockResolvedValue(
      answer({ items: [{ displayName: "Анна", nick: "anna", id: "u1" }], nextCursor: null, total: 1 }),
    );

    await expect(listBlocked()).resolves.toEqual({ ok: false, invalid: true });
  });
});
