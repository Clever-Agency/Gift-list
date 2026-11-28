import type { GiftCard } from "@gift-list/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadOwnerDetail } from "@/ui/wish-detail-load";

const ownerApi = vi.hoisted(() => ({ fetchGift: vi.fn() }));

vi.mock("@/api/my-gifts", () => ownerApi);

function gift(): GiftCard {
  return {
    id: "g1",
    title: "Плед",
    description: "Тёплый",
    priceAmount: null,
    priceCurrency: null,
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
}

beforeEach(() => {
  ownerApi.fetchGift.mockReset();
});

describe("loadOwnerDetail", () => {
  it("отдаёт карточку владельца", async () => {
    ownerApi.fetchGift.mockResolvedValue({ ok: true, gift: gift() });
    await expect(loadOwnerDetail("g1")).resolves.toEqual({ ok: true, gift: gift() });
  });

  it("чужое и отсутствующее — недоступно, без снимка", async () => {
    ownerApi.fetchGift.mockResolvedValue({ ok: false, code: "NOT_FOUND", message: "Gift not found" });
    await expect(loadOwnerDetail("g1")).resolves.toEqual({ ok: false, reason: "not_found" });
  });

  it("сеть", async () => {
    ownerApi.fetchGift.mockResolvedValue({ ok: false, network: true });
    await expect(loadOwnerDetail("g1")).resolves.toEqual({ ok: false, reason: "network" });
  });
});
