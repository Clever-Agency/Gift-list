import { describe, expect, it } from "vitest";
import { SUPPORTED_LOCALES } from "./i18n/locale";
import {
  customTagApprovalSchema,
  customTagQueueItemSchema,
  customTagRejectionSchema,
  tagCatalogItemSchema,
  tagCatalogSchema,
  tagLabelsSchema,
  tagSlugSchema,
} from "./tag";

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

describe("custom tag moderation schemas", () => {
  it("accepts a queue line and rejects owner or wish data", () => {
    const line = { normalizedText: "айфон", sampleText: "Айфон", usageCount: 3 };
    expect(customTagQueueItemSchema.parse(line)).toEqual(line);
    for (const extra of [
      { authorId: "u1" },
      { giftId: "g1" },
      { ownerNick: "nick" },
      { decision: "APPROVED" },
    ]) {
      expect(customTagQueueItemSchema.safeParse({ ...line, ...extra }).success).toBe(false);
    }
  });

  it("requires a positive usage count", () => {
    expect(customTagQueueItemSchema.safeParse({ normalizedText: "x", sampleText: "X", usageCount: 0 }).success).toBe(false);
    expect(customTagQueueItemSchema.safeParse({ normalizedText: "x", sampleText: "X", usageCount: 1.5 }).success).toBe(false);
  });

  it("accepts lower-case Latin slugs with single hyphens", () => {
    for (const slug of ["dream", "need-now", "eco-friendly-2", "a".repeat(40)]) {
      expect(tagSlugSchema.safeParse(slug).success).toBe(true);
    }
  });

  it("rejects a slug with capitals, Cyrillic, spaces or a bad dash", () => {
    for (const slug of ["Dream", "мечта", "two words", "-start", "end-", "double--dash", "", "a".repeat(41)]) {
      expect(tagSlugSchema.safeParse(slug).success).toBe(false);
    }
  });

  it("requires a non-empty caption for every supported language", () => {
    const labels = Object.fromEntries(
      SUPPORTED_LOCALES.map(function label(locale) {
        return [locale, `метка-${locale}`];
      }),
    );
    expect(tagLabelsSchema.parse(labels)).toEqual(labels);

    for (const locale of SUPPORTED_LOCALES) {
      const missing = { ...labels };
      delete missing[locale];
      expect(tagLabelsSchema.safeParse(missing).success).toBe(false);

      expect(tagLabelsSchema.safeParse({ ...labels, [locale]: "   " }).success).toBe(false);
    }

    expect(tagLabelsSchema.safeParse({ ...labels, en: "extra" }).success).toBe(false);
  });

  it("accepts approval into a new tag with a caption per language", () => {
    const body = {
      mode: "new",
      normalizedText: "айфон",
      slug: "iphone",
      labels: { ru: "айфон" },
    };
    expect(customTagApprovalSchema.parse(body)).toEqual(body);
  });

  it("accepts approval into an existing catalog tag", () => {
    const body = { mode: "existing", normalizedText: "айфон", tagId: "tag_phone" };
    expect(customTagApprovalSchema.parse(body)).toEqual(body);
  });

  it("never mixes a new tag and an existing id in one approval", () => {
    expect(
      customTagApprovalSchema.safeParse({
        mode: "new",
        normalizedText: "айфон",
        slug: "iphone",
        labels: { ru: "айфон" },
        tagId: "tag_phone",
      }).success,
    ).toBe(false);

    expect(
      customTagApprovalSchema.safeParse({ mode: "existing", normalizedText: "айфон" }).success,
    ).toBe(false);
  });

  it("validates the normalized text and the rejection body", () => {
    expect(customTagRejectionSchema.parse({ normalizedText: "айфон" })).toEqual({
      normalizedText: "айфон",
    });
    expect(customTagRejectionSchema.safeParse({ normalizedText: "   " }).success).toBe(false);
    expect(customTagRejectionSchema.safeParse({ normalizedText: "айфон", tagId: "t1" }).success).toBe(false);
  });
});
