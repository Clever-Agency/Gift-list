import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchProfile } from "@/api/profile";

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock("@/api/client", () => api);

const owner = { displayName: "Аня", nick: "anya" };

function card(overrides: Record<string, unknown> = {}) {
  return {
    id: "g1",
    title: "Наушники",
    description: null,
    priceAmount: 250000,
    priceCurrency: "RUB",
    linkUrl: null,
    visibility: "PUBLIC",
    quantity: "SINGLE",
    expiresOn: null,
    archivedAt: null,
    tags: [],
    status: "OPEN",
    reservedBy: null,
    reservationLabel: null,
    ownerAction: null,
    ...overrides,
  };
}

function answer(data: unknown) {
  return { ok: true, data };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("fetchProfile", () => {
  it("GETs /api/v1/u/{nick} and returns the named profile", async () => {
    api.apiRequest.mockResolvedValue(
      answer({ access: "gifts", gifts: [card()], owner }),
    );

    await expect(fetchProfile("anya")).resolves.toEqual({
      ok: true,
      access: "gifts",
      gifts: [card()],
      owner,
      relationship: "NONE",
    });
    expect(api.apiRequest).toHaveBeenCalledWith("/api/v1/u/anya");
  });

  it("requests the normalized nick, never the raw segment", async () => {
    api.apiRequest.mockResolvedValue(answer({ access: "gifts", gifts: [], owner }));

    await fetchProfile(" AnyA ");

    expect(api.apiRequest).toHaveBeenCalledWith("/api/v1/u/anya");
  });

  it("passes the closed relationship of the profile answer through", async () => {
    api.apiRequest.mockResolvedValue(
      answer({ access: "gifts", gifts: [], owner, relationship: "INCOMING_PENDING" }),
    );

    await expect(fetchProfile("anya")).resolves.toEqual({
      ok: true,
      access: "gifts",
      gifts: [],
      owner,
      relationship: "INCOMING_PENDING",
    });
  });

  it("passes the profile-only live inviteCooldown through", async () => {
    api.apiRequest.mockResolvedValue(
      answer({
        access: "gifts",
        gifts: [],
        owner,
        relationship: "NONE",
        inviteCooldown: { hours: 23, rejected: true },
      }),
    );

    await expect(fetchProfile("anya")).resolves.toEqual({
      ok: true,
      access: "gifts",
      gifts: [],
      owner,
      relationship: "NONE",
      inviteCooldown: { hours: 23, rejected: true },
    });
  });

  it("leaves the field absent when the cooldown window is closed", async () => {
    api.apiRequest.mockResolvedValue(answer({ access: "gifts", gifts: [], owner }));

    const result = await fetchProfile("anya");

    expect(result).not.toHaveProperty("inviteCooldown");
  });

  it("passes the profile-only subscription flag through", async () => {
    api.apiRequest.mockResolvedValue(
      answer({ access: "gifts", gifts: [], owner, subscribed: true }),
    );

    await expect(fetchProfile("anya")).resolves.toEqual({
      ok: true,
      access: "gifts",
      gifts: [],
      owner,
      relationship: "NONE",
      subscribed: true,
    });
  });

  it("leaves the subscription flag absent when the server sent none", async () => {
    api.apiRequest.mockResolvedValue(answer({ access: "gifts", gifts: [], owner }));

    const result = await fetchProfile("anya");

    expect(result).not.toHaveProperty("subscribed");
  });

  it("passes the optional profile details block through", async () => {
    const details = {
      birthDay: 12,
      birthMonth: 3,
      gender: "FEMALE",
      country: "BY",
      about: "Люблю горы",
    };
    api.apiRequest.mockResolvedValue(
      answer({ access: "gifts", gifts: [], owner, relationship: "FRIENDS", details }),
    );

    await expect(fetchProfile("anya")).resolves.toEqual({
      ok: true,
      access: "gifts",
      gifts: [],
      owner,
      relationship: "FRIENDS",
      details,
    });
  });

  it("leaves the details block absent when the server hid it", async () => {
    api.apiRequest.mockResolvedValue(answer({ access: "gifts", gifts: [], owner }));

    const result = await fetchProfile("anya");

    expect(result).not.toHaveProperty("details");
  });

  it("never filters wishes by visibility on its own", async () => {
    const gifts = [
      card(),
      card({ id: "g2", visibility: "FRIENDS" }),
      card({ id: "g3", visibility: "SECRET" }),
    ];
    api.apiRequest.mockResolvedValue(answer({ access: "gifts", gifts, owner }));

    const result = await fetchProfile("anya");

    expect(result).toEqual({
      ok: true,
      access: "gifts",
      gifts,
      owner,
      relationship: "NONE",
    });
  });

  it("turns the one NOT_FOUND refusal into the closed not_found state", async () => {
    api.apiRequest.mockResolvedValue({
      ok: false,
      code: "NOT_FOUND",
      message: "Not found",
    });

    await expect(fetchProfile("anya")).resolves.toEqual({
      ok: true,
      access: "not_found",
    });
  });

  it("treats the retired not_found success body as outside the contract", async () => {
    api.apiRequest.mockResolvedValue(answer({ access: "not_found", gifts: [] }));

    await expect(fetchProfile("anya")).resolves.toEqual({
      ok: false,
      invalid: true,
    });
  });

  it("treats a found profile without the owner as the same closed gate", async () => {
    api.apiRequest.mockResolvedValue(answer({ access: "gifts", gifts: [card()] }));

    await expect(fetchProfile("anya")).resolves.toEqual({
      ok: true,
      access: "not_found",
    });
  });

  it("does not request a malformed segment", async () => {
    await expect(fetchProfile("a/b")).resolves.toEqual({
      ok: true,
      access: "not_found",
    });
    expect(api.apiRequest).not.toHaveBeenCalled();
  });

  it("passes a transport error through", async () => {
    api.apiRequest.mockResolvedValue({ ok: false, network: true });

    await expect(fetchProfile("anya")).resolves.toEqual({
      ok: false,
      network: true,
    });
  });

  it("rejects a body outside the list contract", async () => {
    api.apiRequest.mockResolvedValue(
      answer({ access: "gifts", gifts: [{ ...card(), bought: true }], owner }),
    );

    await expect(fetchProfile("anya")).resolves.toEqual({
      ok: false,
      invalid: true,
    });
  });
});
