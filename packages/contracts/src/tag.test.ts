import { describe, expect, it } from "vitest";
import { tagCatalogItemSchema, tagCatalogSchema } from "./tag";

const item = { id: "tag_1", slug: "dream", label: "мечта" };

describe("tagCatalogItemSchema", () => {
  it("accepts the three catalog fields", () => {
    expect(tagCatalogItemSchema.parse(item)).toEqual(item);
  });

  it("rejects moderation, aggregate and custom fields", () => {
    for (const extra of [
      { aggregateEligible: true },
      { customText: "своё" },
      { labels: { ru: "мечта" } },
      { createdAt: "2026-11-05T00:00:00.000Z" },
    ]) {
      expect(tagCatalogItemSchema.safeParse({ ...item, ...extra }).success).toBe(false);
    }
  });

  it("requires id, slug and label", () => {
    for (const field of ["id", "slug", "label"] as const) {
      const rest = Object.fromEntries(Object.entries(item).filter(([key]) => key !== field));
      expect(tagCatalogItemSchema.safeParse(rest).success).toBe(false);
    }
  });

  it("rejects an empty id, slug or label", () => {
    expect(tagCatalogItemSchema.safeParse({ ...item, id: "" }).success).toBe(false);
    expect(tagCatalogItemSchema.safeParse({ ...item, slug: "" }).success).toBe(false);
    expect(tagCatalogItemSchema.safeParse({ ...item, label: "" }).success).toBe(false);
  });

  it("rejects a non-object item", () => {
    expect(tagCatalogItemSchema.safeParse("dream").success).toBe(false);
    expect(tagCatalogItemSchema.safeParse(null).success).toBe(false);
  });
});

describe("tagCatalogSchema", () => {
  it("accepts an empty catalog", () => {
    expect(tagCatalogSchema.parse({ tags: [] })).toEqual({ tags: [] });
  });

  it("accepts the fixed catalog", () => {
    const catalog = {
      tags: [
        { id: "t1", slug: "dream", label: "мечта" },
        { id: "t2", slug: "need-now", label: "нужно сейчас" },
        { id: "t3", slug: "someday", label: "когда-нибудь" },
      ],
    };
    expect(tagCatalogSchema.parse(catalog)).toEqual(catalog);
  });

  it("rejects extra keys on the envelope", () => {
    expect(tagCatalogSchema.safeParse({ tags: [], total: 0 }).success).toBe(false);
  });

  it("rejects tags that are not an array", () => {
    expect(tagCatalogSchema.safeParse({ tags: {} }).success).toBe(false);
    expect(tagCatalogSchema.safeParse({ tags: null }).success).toBe(false);
  });

  it("rejects an item without a label", () => {
    expect(tagCatalogSchema.safeParse({ tags: [{ id: "t1", slug: "dream" }] }).success).toBe(false);
  });
});
