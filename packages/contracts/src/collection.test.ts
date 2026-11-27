// CLE-143 (Story 10.1, AD-22): editorial collection contract — the admin form
// bodies, the app answers and the same caps as a wish.
import { describe, expect, it } from "vitest";
import {
  EDITORIAL_DESCRIPTION_MAX,
  EDITORIAL_LINK_URL_MAX,
  EDITORIAL_TITLE_MAX,
  ERROR_REASONS,
  GIFT_DESCRIPTION_MAX,
  GIFT_LINK_URL_MAX,
  GIFT_TITLE_MAX,
  editorialCollectionAdminDetailSchema,
  editorialCollectionAdminSummarySchema,
  editorialCollectionDetailSchema,
  editorialCollectionInputSchema,
  editorialCollectionSummarySchema,
  editorialItemInputSchema,
  editorialItemOrderSchema,
  editorialItemSchema,
} from "./index";

describe("editorial caps (Story 10.1)", () => {
  it("reuses the wish caps instead of inventing its own", () => {
    expect(EDITORIAL_TITLE_MAX).toBe(GIFT_TITLE_MAX);
    expect(EDITORIAL_DESCRIPTION_MAX).toBe(GIFT_DESCRIPTION_MAX);
    expect(EDITORIAL_LINK_URL_MAX).toBe(GIFT_LINK_URL_MAX);
    expect(EDITORIAL_TITLE_MAX).toBe(120);
    expect(EDITORIAL_DESCRIPTION_MAX).toBe(2000);
    expect(EDITORIAL_LINK_URL_MAX).toBe(2048);
  });

  it("has a closed reason for publishing an empty collection", () => {
    expect(ERROR_REASONS).toContain("COLLECTION_EMPTY");
  });
});

describe("editorialCollectionInputSchema", () => {
  it("trims the title and keeps the optional fields empty", () => {
    const input = editorialCollectionInputSchema.parse({ title: "  Для рыбалки  " });
    expect(input).toEqual({
      title: "Для рыбалки",
      description: undefined,
      coverImageUrl: undefined,
    });
  });

  it("refuses a blank title and a title over the wish cap", () => {
    expect(editorialCollectionInputSchema.safeParse({ title: "   " }).success).toBe(false);
    expect(
      editorialCollectionInputSchema.safeParse({ title: "а".repeat(EDITORIAL_TITLE_MAX + 1) })
        .success,
    ).toBe(false);
    expect(
      editorialCollectionInputSchema.safeParse({ title: "а".repeat(EDITORIAL_TITLE_MAX) }).success,
    ).toBe(true);
  });

  it("refuses a description over the wish cap", () => {
    expect(
      editorialCollectionInputSchema.safeParse({
        title: "Идеи",
        description: "а".repeat(EDITORIAL_DESCRIPTION_MAX + 1),
      }).success,
    ).toBe(false);
  });

  it("accepts only an http(s) cover URL", () => {
    expect(
      editorialCollectionInputSchema.safeParse({
        title: "Идеи",
        coverImageUrl: "https://cdn.example.com/cover.jpg",
      }).success,
    ).toBe(true);
    expect(
      editorialCollectionInputSchema.safeParse({
        title: "Идеи",
        coverImageUrl: "http://cdn.example.com/cover.jpg",
      }).success,
    ).toBe(true);
    expect(
      editorialCollectionInputSchema.safeParse({ title: "Идеи", coverImageUrl: "ftp://example.com/a" })
        .success,
    ).toBe(false);
    expect(
      editorialCollectionInputSchema.safeParse({
        title: "Идеи",
        coverImageUrl: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });

  it("treats an empty cover field as no image", () => {
    const input = editorialCollectionInputSchema.parse({ title: "Идеи", coverImageUrl: "" });
    expect(input.coverImageUrl).toBeNull();
  });

  it("does not accept the publication state from a client", () => {
    expect(
      editorialCollectionInputSchema.safeParse({
        title: "Идеи",
        publishedAt: "2026-11-28T00:00:00.000Z",
      }).success,
    ).toBe(false);
  });
});

describe("editorialItemInputSchema", () => {
  it("accepts a title-only idea", () => {
    expect(editorialItemInputSchema.safeParse({ title: "Термос" }).success).toBe(true);
  });

  it("refuses a link that is not an http(s) URL", () => {
    expect(
      editorialItemInputSchema.safeParse({ title: "Термос", linkUrl: "not a url" }).success,
    ).toBe(false);
    expect(
      editorialItemInputSchema.safeParse({ title: "Термос", linkUrl: "https://example.com/termos" })
        .success,
    ).toBe(true);
  });

  it("refuses an image that is not an http(s) URL", () => {
    expect(
      editorialItemInputSchema.safeParse({ title: "Термос", imageUrl: "data:image/png;base64,AA" })
        .success,
    ).toBe(false);
    expect(
      editorialItemInputSchema.safeParse({
        title: "Термос",
        imageUrl: "https://cdn.example.com/termos.jpg",
      }).success,
    ).toBe(true);
  });

  it("has no blogger field (Q-14)", () => {
    expect(
      editorialItemInputSchema.safeParse({ title: "Термос", blogger: "someone" }).success,
    ).toBe(false);
  });
});

describe("editorialItemOrderSchema", () => {
  it("requires at least one id", () => {
    expect(editorialItemOrderSchema.safeParse({ itemIds: [] }).success).toBe(false);
  });

  it("refuses a repeated id", () => {
    expect(editorialItemOrderSchema.safeParse({ itemIds: ["i1", "i1"] }).success).toBe(false);
  });

  it("accepts the full order", () => {
    expect(editorialItemOrderSchema.safeParse({ itemIds: ["i2", "i1"] }).success).toBe(true);
  });
});

const item = {
  id: "i1",
  title: "Термос",
  description: null,
  linkUrl: "https://example.com/termos",
  imageUrl: null,
};

describe("app answers", () => {
  it("parses a summary without idea rows", () => {
    expect(
      editorialCollectionSummarySchema.parse({
        id: "c1",
        title: "Для рыбалки",
        description: null,
        coverImageUrl: null,
        itemCount: 3,
      }),
    ).toBeTruthy();
  });

  it("parses a detail with the ideas of the screen", () => {
    const detail = editorialCollectionDetailSchema.parse({
      id: "c1",
      title: "Для рыбалки",
      description: "Идеи для тех, кто любит воду",
      coverImageUrl: null,
      itemCount: 1,
      items: [item],
    });
    expect(detail.items).toHaveLength(1);
  });

  it("does not carry the admin position to the app", () => {
    expect(
      editorialItemSchema.safeParse({ ...item, position: 0 }).success,
    ).toBe(false);
  });
});

describe("admin answers", () => {
  it("parses a table row with the publication state", () => {
    expect(
      editorialCollectionAdminSummarySchema.parse({
        id: "c1",
        title: "Для рыбалки",
        description: null,
        coverImageUrl: null,
        itemCount: 0,
        publishedAt: null,
      }).publishedAt,
    ).toBeNull();
  });

  it("keeps the position of an idea in the admin detail only", () => {
    const detail = editorialCollectionAdminDetailSchema.parse({
      id: "c1",
      title: "Для рыбалки",
      description: null,
      coverImageUrl: null,
      itemCount: 1,
      publishedAt: "2026-11-28T00:00:00.000Z",
      items: [{ ...item, position: 4 }],
    });
    expect(detail.items[0]?.position).toBe(4);
  });
});
