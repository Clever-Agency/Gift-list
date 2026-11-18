import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getViewerGift } = vi.hoisted(() => ({ getViewerGift: vi.fn() }));

vi.mock("@/actions/gift-viewer", () => ({ getViewerGift }));

const card = {
  id: "g1",
  title: "Плед",
  description: null,
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

function context(id = "g1") {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  getViewerGift.mockReset();
  getViewerGift.mockResolvedValue({ ok: true, data: card });
});

describe("GET /api/v1/gifts/[id]", () => {
  it("passes the list token from the query into the action", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://x/api/v1/gifts/g1?listToken=list_token"),
      context(),
    );

    expect(response.status).toBe(200);
    expect(getViewerGift).toHaveBeenCalledWith(expect.any(Headers), "g1", "list_token");
  });
});
