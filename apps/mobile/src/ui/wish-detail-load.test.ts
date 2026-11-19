import type { GiftCard } from "@gift-list/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadOwnerDetail, loadViewerDetail } from "@/ui/wish-detail-load";

const ownerApi = vi.hoisted(() => ({ fetchGift: vi.fn() }));
const viewerApi = vi.hoisted(() => ({ fetchViewerGift: vi.fn() }));

vi.mock("@/api/my-gifts", () => ownerApi);
vi.mock("@/api/viewer-gift", () => viewerApi);

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
  viewerApi.fetchViewerGift.mockReset();
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

describe("loadViewerDetail", () => {
  it("гость получает ответ сервера", async () => {
    viewerApi.fetchViewerGift.mockResolvedValue({ ok: true, gift: gift() });
    await expect(loadViewerDetail("g1", "tok", gift())).resolves.toEqual({ ok: true, gift: gift() });
  });

  it("скрытое желание — не найдено, снимок не возвращается", async () => {
    viewerApi.fetchViewerGift.mockResolvedValue({ ok: false, code: "NOT_FOUND", message: "Gift not found" });
    const result = await loadViewerDetail("g1", "tok", gift());
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("401 и 403 оставляют уже разрешённую карточку списка", async () => {
    viewerApi.fetchViewerGift.mockResolvedValue({
      ok: false,
      code: "FORBIDDEN",
      message: "Forbidden",
    });
    await expect(loadViewerDetail("g1", "tok", gift())).resolves.toEqual({ ok: true, gift: gift() });

    viewerApi.fetchViewerGift.mockResolvedValue({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
    await expect(loadViewerDetail("g1", undefined, gift())).resolves.toEqual({
      ok: true,
      gift: gift(),
    });
  });
});
