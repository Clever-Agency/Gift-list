import { describe, expect, it, vi } from "vitest";
import { fetchMyGifts } from "@/api/my-gifts";

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock("@/api/client", () => api);

const card = {
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
};

describe("fetchMyGifts", () => {
  it("reads the owner list from /api/v1/me/gifts and returns the cards", async () => {
    api.apiRequest.mockResolvedValue({ ok: true, data: { access: "gifts", gifts: [card] } });

    const result = await fetchMyGifts();

    expect(api.apiRequest).toHaveBeenCalledWith("/api/v1/me/gifts");
    expect(result).toEqual({ ok: true, gifts: [card] });
  });

  it("passes a network failure through", async () => {
    api.apiRequest.mockResolvedValue({ ok: false, network: true });

    await expect(fetchMyGifts()).resolves.toEqual({ ok: false, network: true });
  });

  it("passes an action error through", async () => {
    api.apiRequest.mockResolvedValue({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });

    await expect(fetchMyGifts()).resolves.toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
  });

  it("rejects a card with an unknown key instead of rendering it", async () => {
    api.apiRequest.mockResolvedValue({
      ok: true,
      data: { access: "gifts", gifts: [{ ...card, bought: true }] },
    });

    await expect(fetchMyGifts()).resolves.toEqual({ ok: false, network: true });
  });

  it("rejects a card with an unknown status", async () => {
    api.apiRequest.mockResolvedValue({
      ok: true,
      data: { access: "gifts", gifts: [{ ...card, status: "COLLECTION" }] },
    });

    await expect(fetchMyGifts()).resolves.toEqual({ ok: false, network: true });
  });

  it("treats a closed gate as an empty list", async () => {
    api.apiRequest.mockResolvedValue({ ok: true, data: { access: "not_found", gifts: [] } });

    await expect(fetchMyGifts()).resolves.toEqual({ ok: true, gifts: [] });
  });
});
