import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, findFirst, relationsBetween } = vi.hoisted(() => ({
  getSession: vi.fn(),
  findFirst: vi.fn(),
  relationsBetween: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({ prisma: { gift: { findFirst } } }));
vi.mock("@/lib/relationships", () => ({ relationshipReader: { relationsBetween } }));

import { getViewerGift } from "./gift-viewer";

const headers = new Headers();

const row = {
  id: "g1",
  title: "Плед",
  description: null,
  priceAmount: null,
  priceCurrency: null,
  linkUrl: null,
  visibility: "PUBLIC" as const,
  quantity: "SINGLE" as const,
  expiresOn: null,
  archivedAt: null,
  status: "OPEN" as const,
  reservationPhase: null,
  reservationDueAt: null,
  reservationTimeZone: null,
  reservationBought: false,
  holderVisibleToOwner: false,
  holderVisibleToOthers: true,
  reservedBy: null,
  tags: [],
  list: { ownerId: "owner", publicToken: "list_token" },
};

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ user: { id: "donor" } });
  relationsBetween.mockResolvedValue({
    blocked: false,
    friend: false,
    subscriber: false,
    contactMatch: false,
  });
  findFirst.mockResolvedValue(row);
});

describe("getViewerGift", () => {
  it("answers FORBIDDEN for the owner", async () => {
    getSession.mockResolvedValue({ user: { id: "owner" } });

    const result = await getViewerGift(headers, "g1");

    expect(result).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });

  it("answers NOT_FOUND for a stranger without the list token", async () => {
    const result = await getViewerGift(headers, "g1");

    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  it("returns the card when the list token matches", async () => {
    const result = await getViewerGift(headers, "g1", "list_token");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.id).toBe("g1");
  });
});
