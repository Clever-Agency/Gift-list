import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchPublicWishlist } from "@/api/public-wishlist";

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

function link(data: unknown) {
  return { ok: true, data };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("fetchPublicWishlist", () => {
  it("GETs /api/v1/l/{token} and returns the named list", async () => {
    api.apiRequest.mockResolvedValue(
      link({ access: "gifts", gifts: [card()], owner }),
    );

    await expect(fetchPublicWishlist("tok_1")).resolves.toEqual({
      ok: true,
      access: "gifts",
      gifts: [card()],
      owner,
    });
    expect(api.apiRequest).toHaveBeenCalledWith("/api/v1/l/tok_1");
  });

  it("keeps the closed not_found answer without an owner block", async () => {
    api.apiRequest.mockResolvedValue(link({ access: "not_found", gifts: [] }));

    await expect(fetchPublicWishlist("tok_1")).resolves.toEqual({
      ok: true,
      access: "not_found",
    });
  });

  it("treats a found list without the owner as the same closed gate", async () => {
    api.apiRequest.mockResolvedValue(link({ access: "gifts", gifts: [card()] }));

    await expect(fetchPublicWishlist("tok_1")).resolves.toEqual({
      ok: true,
      access: "not_found",
    });
  });

  it("does not request a malformed segment", async () => {
    await expect(fetchPublicWishlist("a/b")).resolves.toEqual({
      ok: true,
      access: "not_found",
    });
    expect(api.apiRequest).not.toHaveBeenCalled();
  });

  it("passes a transport error through", async () => {
    api.apiRequest.mockResolvedValue({ ok: false, network: true });

    await expect(fetchPublicWishlist("tok_1")).resolves.toEqual({
      ok: false,
      network: true,
    });
  });

  it("rejects a body outside the list contract", async () => {
    api.apiRequest.mockResolvedValue(
      link({ access: "gifts", gifts: [{ ...card(), bought: true }], owner }),
    );

    await expect(fetchPublicWishlist("tok_1")).resolves.toEqual({
      ok: false,
      invalid: true,
    });
  });
});
