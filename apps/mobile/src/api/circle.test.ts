import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelFriendInvite,
  fetchFriends,
  fetchInvites,
  fetchSubscribers,
  fetchSubscriptions,
  removeFriend,
  removeSubscriber,
} from "@/api/circle";

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock("@/api/client", () => api);

const alena = {
  displayName: "Алёна",
  nick: "alena",
  relationship: "FRIENDS",
  subscribed: false,
  followsYou: false,
};

const page = { items: [alena], nextCursor: "cursor-1", total: 1 };

function answer(data: unknown) {
  return { ok: true, data };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("fetchFriends", () => {
  it("GETs the friends page without a query when the field is empty", async () => {
    api.apiRequest.mockResolvedValue(answer(page));

    await expect(fetchFriends("")).resolves.toEqual({ ok: true, page });
    expect(api.apiRequest).toHaveBeenCalledWith("/api/v1/me/friends");
  });

  it("sends the search query without the optional @ and keeps the cursor", async () => {
    api.apiRequest.mockResolvedValue(answer(page));

    await fetchFriends(" @alena ", "next page&1");

    expect(api.apiRequest).toHaveBeenCalledWith(
      `/api/v1/me/friends?q=alena&cursor=${encodeURIComponent("next page&1")}`,
    );
  });

  it("keeps a plain Cyrillic name and encodes it", async () => {
    api.apiRequest.mockResolvedValue(answer(page));

    await fetchFriends("Алёна");

    expect(api.apiRequest).toHaveBeenCalledWith(
      `/api/v1/me/friends?q=${encodeURIComponent("Алёна")}`,
    );
  });

  it("passes a transport error and the dead session through", async () => {
    api.apiRequest.mockResolvedValueOnce({ ok: false, network: true });
    await expect(fetchFriends()).resolves.toEqual({ ok: false, network: true });

    api.apiRequest.mockResolvedValueOnce({ ok: false, code: "UNAUTHENTICATED", message: "" });
    await expect(fetchFriends()).resolves.toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "",
    });
  });

  it("rejects a body outside the circle contract", async () => {
    api.apiRequest.mockResolvedValue(answer({ items: [{ ...alena, email: "a@b.test" }], nextCursor: null, total: 1 }));

    await expect(fetchFriends()).resolves.toEqual({ ok: false, invalid: true });
  });
});

describe("subscription lists", () => {
  it("GETs /me/subscriptions and /me/subscribers with their own cursor", async () => {
    api.apiRequest.mockResolvedValue(answer(page));

    await fetchSubscriptions("@a");
    await fetchSubscribers("b");

    expect(api.apiRequest).toHaveBeenNthCalledWith(1, "/api/v1/me/subscriptions?cursor=%40a");
    expect(api.apiRequest).toHaveBeenNthCalledWith(2, "/api/v1/me/subscribers?cursor=b");
  });

  it("reads the page without a cursor", async () => {
    api.apiRequest.mockResolvedValue(answer(page));

    await expect(fetchSubscribers()).resolves.toEqual({ ok: true, page });
    expect(api.apiRequest).toHaveBeenCalledWith("/api/v1/me/subscribers");
  });
});

describe("fetchInvites", () => {
  const invites = {
    incoming: page,
    outgoing: { items: [], nextCursor: null, total: 0 },
    incomingCount: 1,
  };

  it("GETs both halves and the badge count without cursors", async () => {
    api.apiRequest.mockResolvedValue(answer(invites));

    await expect(fetchInvites()).resolves.toEqual({ ok: true, invites });
    expect(api.apiRequest).toHaveBeenCalledWith("/api/v1/me/invites");
  });

  it("keeps one cursor per half", async () => {
    api.apiRequest.mockResolvedValue(answer(invites));

    await fetchInvites("in-1", "out-2");

    expect(api.apiRequest).toHaveBeenCalledWith(
      "/api/v1/me/invites?incomingCursor=in-1&outgoingCursor=out-2",
    );
  });

  it("rejects a body without the incoming count", async () => {
    api.apiRequest.mockResolvedValue(answer({ incoming: page, outgoing: page }));

    await expect(fetchInvites()).resolves.toEqual({ ok: false, invalid: true });
  });
});

describe("cancelFriendInvite", () => {
  it("DELETEs the invite of the normalized nick", async () => {
    api.apiRequest.mockResolvedValue(answer({ outcome: "CANCELLED" }));

    await expect(cancelFriendInvite(" AnyA ")).resolves.toEqual({
      ok: true,
      outcome: "CANCELLED",
    });
    expect(api.apiRequest).toHaveBeenCalledWith("/api/v1/u/anya/invite", {
      method: "DELETE",
    });
  });

  it("keeps the closed outcome set, including the successful no-op", async () => {
    api.apiRequest.mockResolvedValue(answer({ outcome: "ALREADY_FRIENDS" }));

    await expect(cancelFriendInvite("anya")).resolves.toEqual({
      ok: true,
      outcome: "ALREADY_FRIENDS",
    });
  });

  it("does not request a malformed segment", async () => {
    await expect(cancelFriendInvite("a/b")).resolves.toEqual({ ok: false, invalid: true });
    expect(api.apiRequest).not.toHaveBeenCalled();
  });

  it("rejects an answer outside the cancel contract", async () => {
    api.apiRequest.mockResolvedValue(answer({ outcome: "REJECTED" }));

    await expect(cancelFriendInvite("anya")).resolves.toEqual({ ok: false, invalid: true });
  });
});

describe("removeFriend", () => {
  it("DELETEs the friend segment of the normalized nick without a body", async () => {
    api.apiRequest.mockResolvedValue(answer({ outcome: "REMOVED" }));

    await expect(removeFriend(" AnyA ")).resolves.toEqual({ ok: true, outcome: "REMOVED" });
    expect(api.apiRequest).toHaveBeenCalledWith("/api/v1/u/anya/friend", {
      method: "DELETE",
    });
  });

  it("keeps the closed outcome set, including the successful repeat", async () => {
    api.apiRequest.mockResolvedValue(answer({ outcome: "ALREADY_REMOVED" }));

    await expect(removeFriend("anya")).resolves.toEqual({
      ok: true,
      outcome: "ALREADY_REMOVED",
    });
  });

  it("does not request a malformed segment", async () => {
    await expect(removeFriend("a/b")).resolves.toEqual({ ok: false, invalid: true });
    expect(api.apiRequest).not.toHaveBeenCalled();
  });

  it("passes a transport error and an API refusal through untouched", async () => {
    api.apiRequest.mockResolvedValueOnce({ ok: false, network: true });
    await expect(removeFriend("anya")).resolves.toEqual({ ok: false, network: true });

    api.apiRequest.mockResolvedValueOnce({ ok: false, code: "FORBIDDEN", message: "" });
    await expect(removeFriend("anya")).resolves.toEqual({
      ok: false,
      code: "FORBIDDEN",
      message: "",
    });
  });

  it("rejects an answer outside the remove contract", async () => {
    api.apiRequest.mockResolvedValue(answer({ outcome: "CANCELLED" }));

    await expect(removeFriend("anya")).resolves.toEqual({ ok: false, invalid: true });
  });
});

describe("removeSubscriber", () => {
  it("DELETEs the subscriber edge of the session owner", async () => {
    api.apiRequest.mockResolvedValue(answer({ outcome: "UNSUBSCRIBED" }));

    await expect(removeSubscriber(" AnyA ", " Oleg ")).resolves.toEqual({
      ok: true,
      outcome: "UNSUBSCRIBED",
    });
    expect(api.apiRequest).toHaveBeenCalledWith("/api/v1/u/anya/subscribers/oleg", {
      method: "DELETE",
    });
  });

  it("treats the repeat as the same successful no-op", async () => {
    api.apiRequest.mockResolvedValue(answer({ outcome: "NOT_SUBSCRIBED" }));

    await expect(removeSubscriber("anya", "oleg")).resolves.toEqual({
      ok: true,
      outcome: "NOT_SUBSCRIBED",
    });
  });

  it("does not request a malformed owner or subscriber segment", async () => {
    await expect(removeSubscriber("a/b", "oleg")).resolves.toEqual({
      ok: false,
      invalid: true,
    });
    await expect(removeSubscriber("anya", "../oleg")).resolves.toEqual({
      ok: false,
      invalid: true,
    });
    expect(api.apiRequest).not.toHaveBeenCalled();
  });

  it("passes an API refusal through untouched", async () => {
    api.apiRequest.mockResolvedValue({ ok: false, code: "FORBIDDEN", message: "" });

    await expect(removeSubscriber("anya", "oleg")).resolves.toEqual({
      ok: false,
      code: "FORBIDDEN",
      message: "",
    });
  });
});
