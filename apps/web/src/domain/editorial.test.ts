// CLE-143 (Story 10.1, AD-22): publication, order and the two answers of an
// editorial collection.
import { describe, expect, it } from "vitest";
import {
  canPublishCollection,
  isCollectionPublished,
  nextItemPosition,
  orderedItemIds,
  toAdminDetail,
  toCollectionDetail,
  visibleCollectionDetail,
  type EditorialCollectionStored,
  type EditorialItemStored,
} from "./editorial";

function idea(overrides: Partial<EditorialItemStored> = {}): EditorialItemStored {
  return {
    id: "i1",
    title: "Термос",
    description: null,
    linkUrl: null,
    imageUrl: null,
    position: 0,
    ...overrides,
  };
}

function collection(
  overrides: Partial<EditorialCollectionStored> = {},
): EditorialCollectionStored {
  return {
    id: "c1",
    title: "Для рыбалки",
    description: null,
    coverImageUrl: null,
    publishedAt: new Date("2026-11-01T00:00:00.000Z"),
    updatedAt: new Date("2026-11-02T00:00:00.000Z"),
    items: [idea()],
    ...overrides,
  };
}

const NOW = new Date("2026-11-28T00:00:00.000Z");

describe("publication (Story 10.1)", () => {
  it("treats a draft as unpublished", () => {
    expect(isCollectionPublished(null, NOW)).toBe(false);
    expect(visibleCollectionDetail(collection({ publishedAt: null }), NOW)).toBeNull();
  });

  it("treats a future publication as unpublished until its moment", () => {
    const future = new Date("2027-01-01T00:00:00.000Z");
    expect(isCollectionPublished(future, NOW)).toBe(false);
    expect(visibleCollectionDetail(collection({ publishedAt: future }), NOW)).toBeNull();
  });

  it("shows a collection published before now", () => {
    expect(isCollectionPublished(new Date("2026-11-01T00:00:00.000Z"), NOW)).toBe(true);
    expect(visibleCollectionDetail(collection(), NOW)).not.toBeNull();
  });

  it("refuses to publish an empty collection", () => {
    expect(canPublishCollection(0)).toBe(false);
    expect(canPublishCollection(1)).toBe(true);
  });
});

describe("item order (Story 10.1)", () => {
  it("puts a new idea after the last stored one", () => {
    expect(nextItemPosition([])).toBe(0);
    expect(nextItemPosition([{ position: 0 }, { position: 1 }])).toBe(2);
    expect(nextItemPosition([{ position: 0 }, { position: 5 }])).toBe(6);
  });

  it("accepts a reorder of exactly the stored set", () => {
    expect(orderedItemIds(["i1", "i2", "i3"], ["i3", "i1", "i2"])).toEqual([
      "i3",
      "i1",
      "i2",
    ]);
  });

  it("refuses a missing, unknown or repeated id", () => {
    expect(orderedItemIds(["i1", "i2"], ["i1"])).toBeNull();
    expect(orderedItemIds(["i1", "i2"], ["i1", "i9"])).toBeNull();
    expect(orderedItemIds(["i1", "i2"], ["i1", "i1"])).toBeNull();
    expect(orderedItemIds(["i1", "i1"], ["i1", "i1"])).toBeNull();
  });
});

describe("answers", () => {
  it("keeps the ideas in the stored order", () => {
    const detail = toCollectionDetail(
      collection({
        items: [idea({ id: "i1", position: 0 }), idea({ id: "i2", position: 1 })],
      }),
    );
    expect(detail.items.map((row) => row.id)).toEqual(["i1", "i2"]);
    expect(detail.itemCount).toBe(2);
  });

  it("does not send the position to the app", () => {
    const detail = toCollectionDetail(collection());
    expect(detail.items[0]).not.toHaveProperty("position");
  });

  it("gives the admin panel the position and an ISO publication instant", () => {
    const detail = toAdminDetail(collection({ items: [idea({ position: 4 })] }));
    expect(detail.items[0]?.position).toBe(4);
    expect(detail.publishedAt).toBe("2026-11-01T00:00:00.000Z");
  });

  it("answers a draft with a null publication instant", () => {
    const detail = toAdminDetail(collection({ publishedAt: null }));
    expect(detail.publishedAt).toBeNull();
  });
});
