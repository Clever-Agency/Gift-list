import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  getSession,
  listPublishedEditorialCollections,
  getPublishedEditorialCollection,
  createGift,
} = vi.hoisted(() => ({
  getSession: vi.fn(),
  listPublishedEditorialCollections: vi.fn(),
  getPublishedEditorialCollection: vi.fn(),
  createGift: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/lib/editorial-store", () => ({
  listPublishedEditorialCollections,
  getPublishedEditorialCollection,
}));
vi.mock("@/actions/gifts", () => ({ createGift }));

import {
  addCollectionItemToWishlist,
  getCollection,
  listCollections,
} from "./collections";

const headers = new Headers({ authorization: "Bearer t" });

const summary = {
  id: "c1",
  title: "Для рыбалки",
  description: "Идеи для тех, кто любит воду",
  coverImageUrl: "https://cdn.example.com/fishing.jpg",
  itemCount: 1,
};

const item = {
  id: "i1",
  title: "Термос",
  description: "Держит тепло сутки",
  linkUrl: "https://shop.example/termos",
  imageUrl: "https://cdn.example.com/termos.jpg",
};

const detail = { ...summary, items: [item] };

const card = {
  id: "g1",
  title: "Термос",
  description: "Держит тепло сутки",
  priceAmount: null,
  priceCurrency: null,
  linkUrl: "https://shop.example/termos",
  visibility: "PUBLIC" as const,
  quantity: "SINGLE" as const,
  expiresOn: null,
  archivedAt: null,
  tags: [],
  status: "OPEN" as const,
  reservedBy: null,
  reservationLabel: null,
  ownerAction: null,
  undoUntil: null,
};

beforeEach(() => {
  getSession.mockReset();
  listPublishedEditorialCollections.mockReset();
  getPublishedEditorialCollection.mockReset();
  createGift.mockReset();

  getSession.mockResolvedValue({ user: { id: "u1" }, session: { token: "t" } });
  listPublishedEditorialCollections.mockResolvedValue([summary]);
  getPublishedEditorialCollection.mockResolvedValue(detail);
  createGift.mockResolvedValue({ ok: true, data: card });
});

describe("GET /api/v1/collections — listCollections", () => {
  it("answers the published collections in the named `collections` key", async () => {
    await expect(listCollections(headers)).resolves.toEqual({
      ok: true,
      data: { collections: [summary] },
    });
    expect(listPublishedEditorialCollections).toHaveBeenCalledWith();
    expect(getSession).toHaveBeenCalledWith({ headers });
  });

  it("answers an empty list when nothing is published", async () => {
    listPublishedEditorialCollections.mockResolvedValue([]);
    await expect(listCollections(headers)).resolves.toEqual({
      ok: true,
      data: { collections: [] },
    });
  });

  it("answers UNAUTHENTICATED without a session and reads nothing", async () => {
    getSession.mockResolvedValue(null);

    await expect(listCollections(headers)).resolves.toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
    expect(listPublishedEditorialCollections).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/collections/[id] — getCollection", () => {
  it("answers one published collection with its ideas", async () => {
    await expect(getCollection(headers, "c1")).resolves.toEqual({ ok: true, data: detail });
    expect(getPublishedEditorialCollection).toHaveBeenCalledWith("c1");
  });

  it("masks a draft, a future publication and an unknown id as NOT_FOUND", async () => {
    getPublishedEditorialCollection.mockResolvedValue(null);

    await expect(getCollection(headers, "c1")).resolves.toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Not found",
    });
  });

  it("answers UNAUTHENTICATED without a session and reads nothing", async () => {
    getSession.mockResolvedValue(null);

    await expect(getCollection(headers, "c1")).resolves.toMatchObject({
      ok: false,
      code: "UNAUTHENTICATED",
    });
    expect(getPublishedEditorialCollection).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/collections/[id]/items/[itemId]/add — addCollectionItemToWishlist", () => {
  it("creates a wish through the existing create use-case", async () => {
    await expect(addCollectionItemToWishlist(headers, "c1", "i1")).resolves.toEqual({
      ok: true,
      data: card,
    });

    expect(getPublishedEditorialCollection).toHaveBeenCalledWith("c1");
    expect(createGift).toHaveBeenCalledWith(headers, {
      title: "Термос",
      description: "Держит тепло сутки",
      linkUrl: "https://shop.example/termos",
    });
    // The idea's picture stays on the collection card: a wish has no picture field.
    expect(createGift.mock.calls[0]?.[1]).not.toHaveProperty("imageUrl");
  });

  it("answers UNAUTHENTICATED without a session and writes nothing", async () => {
    getSession.mockResolvedValue(null);

    await expect(addCollectionItemToWishlist(headers, "c1", "i1")).resolves.toMatchObject({
      ok: false,
      code: "UNAUTHENTICATED",
    });
    expect(getPublishedEditorialCollection).not.toHaveBeenCalled();
    expect(createGift).not.toHaveBeenCalled();
  });

  it("masks a draft or a missing collection as NOT_FOUND", async () => {
    getPublishedEditorialCollection.mockResolvedValue(null);

    await expect(addCollectionItemToWishlist(headers, "c1", "i1")).resolves.toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Not found",
    });
    expect(createGift).not.toHaveBeenCalled();
  });

  it("masks an idea of another collection as NOT_FOUND", async () => {
    await expect(addCollectionItemToWishlist(headers, "c1", "i-foreign")).resolves.toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Not found",
    });
    expect(createGift).not.toHaveBeenCalled();
  });

  it("passes the create result through, including its limits", async () => {
    const refusal = {
      ok: false as const,
      code: "VALIDATION" as const,
      message: "Invalid input",
      field: "title",
    };
    createGift.mockResolvedValue(refusal);

    await expect(addCollectionItemToWishlist(headers, "c1", "i1")).resolves.toEqual(refusal);
  });
});
