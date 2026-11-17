import { beforeEach, describe, expect, it, vi } from "vitest";
import { acceptInvite, getInvitePreview, getMyInviteLink } from "@/api/invite-link";

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock("@/api/client", () => api);

const inviter = { displayName: "Анна", nick: "anna" };

beforeEach(() => {
  vi.resetAllMocks();
});

describe("getMyInviteLink", () => {
  it("GETs the own link and returns the token", async () => {
    api.apiRequest.mockResolvedValue({ ok: true, data: { token: "cu2token" } });

    await expect(getMyInviteLink()).resolves.toEqual({ ok: true, token: "cu2token" });
    expect(api.apiRequest).toHaveBeenCalledWith("/api/v1/me/invite-link");
  });

  it("rejects an answer that also carries a url or another extra field", async () => {
    api.apiRequest.mockResolvedValue({
      ok: true,
      data: { token: "cu2token", url: "https://x/i/cu2token" },
    });

    await expect(getMyInviteLink()).resolves.toEqual({ ok: false, invalid: true });
  });

  it("passes a refusal and a transport error through", async () => {
    api.apiRequest.mockResolvedValue({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
    await expect(getMyInviteLink()).resolves.toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });

    api.apiRequest.mockResolvedValue({ ok: false, network: true });
    await expect(getMyInviteLink()).resolves.toEqual({ ok: false, network: true });
  });
});

describe("getInvitePreview", () => {
  it("GETs one encoded segment and keeps the guest answer without a state", async () => {
    api.apiRequest.mockResolvedValue({ ok: true, data: { inviter } });

    const result = await getInvitePreview("cu2token");

    expect(result).toEqual({ ok: true, inviter });
    expect(result).not.toHaveProperty("state");
    expect(api.apiRequest).toHaveBeenCalledWith("/api/v1/i/cu2token");
  });

  it("keeps the signed-in closed state", async () => {
    for (const state of ["self", "friends", "can_accept"] as const) {
      api.apiRequest.mockResolvedValue({ ok: true, data: { inviter, state } });
      await expect(getInvitePreview("cu2token")).resolves.toEqual({
        ok: true,
        inviter,
        state,
      });
    }
  });

  it("rejects a malformed segment without a request", async () => {
    for (const token of ["", "..", "a/b", "a\\b", "%2f", "x".repeat(129)]) {
      await expect(getInvitePreview(token), token).resolves.toEqual({
        ok: false,
        invalid: true,
      });
    }
    expect(api.apiRequest).not.toHaveBeenCalled();
  });

  it("rejects an answer outside the closed preview contract", async () => {
    api.apiRequest.mockResolvedValue({
      ok: true,
      data: { inviter: { ...inviter, id: "u1" }, state: "can_accept" },
    });

    await expect(getInvitePreview("cu2token")).resolves.toEqual({ ok: false, invalid: true });
  });

  it("passes the same NOT_FOUND refusal for an unknown token and a block", async () => {
    const refusal = { ok: false, code: "NOT_FOUND", message: "Not found" };
    api.apiRequest.mockResolvedValue(refusal);

    await expect(getInvitePreview("cu2token")).resolves.toEqual(refusal);
    await expect(getInvitePreview("blocked")).resolves.toEqual(refusal);
  });
});

describe("acceptInvite", () => {
  it("POSTs one segment without a body and returns the closed outcome", async () => {
    api.apiRequest.mockResolvedValue({ ok: true, data: { outcome: "FRIENDS" } });

    await expect(acceptInvite("cu2token")).resolves.toEqual({ ok: true, outcome: "FRIENDS" });
    expect(api.apiRequest).toHaveBeenCalledWith("/api/v1/i/cu2token/accept", {
      method: "POST",
    });
  });

  it("keeps ALREADY_FRIENDS a successful no-op", async () => {
    api.apiRequest.mockResolvedValue({ ok: true, data: { outcome: "ALREADY_FRIENDS" } });

    await expect(acceptInvite("cu2token")).resolves.toEqual({
      ok: true,
      outcome: "ALREADY_FRIENDS",
    });
  });

  it("does not request a malformed segment", async () => {
    await expect(acceptInvite("a/b")).resolves.toEqual({ ok: false, invalid: true });
    expect(api.apiRequest).not.toHaveBeenCalled();
  });

  it("rejects an answer outside the accept contract", async () => {
    api.apiRequest.mockResolvedValue({ ok: true, data: { outcome: "FRIENDS_CREATED" } });

    await expect(acceptInvite("cu2token")).resolves.toEqual({ ok: false, invalid: true });
  });

  it("passes the self refusal through untouched", async () => {
    api.apiRequest.mockResolvedValue({ ok: false, code: "FORBIDDEN", message: "Forbidden" });

    await expect(acceptInvite("cu2token")).resolves.toEqual({
      ok: false,
      code: "FORBIDDEN",
      message: "Forbidden",
    });
  });
});
