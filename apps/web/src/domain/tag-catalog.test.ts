import { describe, expect, it } from "vitest";
import type { SupportedLocale } from "@gift-list/contracts";
import { compareTagCatalogSlugs, pickTagLabel, toTagCatalogItem } from "./tag";

/**
 * Only `ru` is supported today. The cast models a future catalog row so the
 * fallback rule is tested before a second locale is added to `SUPPORTED_LOCALES`.
 */
const futureLocale = "en" as SupportedLocale;

describe("pickTagLabel", () => {
  it("uses the label of the requested locale", () => {
    expect(pickTagLabel({ ru: "мечта", en: "dream" }, futureLocale)).toBe("dream");
    expect(pickTagLabel({ ru: "мечта" }, "ru")).toBe("мечта");
  });

  it("falls back to DEFAULT_LOCALE when the requested label is missing", () => {
    expect(pickTagLabel({ ru: "мечта" }, futureLocale)).toBe("мечта");
  });

  it("does not use a blank label or a non-object", () => {
    expect(pickTagLabel({ ru: "мечта", en: "   " }, futureLocale)).toBe("мечта");
    expect(pickTagLabel({ ru: "   " }, "ru")).toBe("");
    expect(pickTagLabel(["мечта"], "ru")).toBe("");
    expect(pickTagLabel(null, "ru")).toBe("");
    expect(pickTagLabel("мечта", "ru")).toBe("");
  });

  it("trims stray spaces from an ADMIN-entered label", () => {
    expect(pickTagLabel({ ru: "  мечта  " }, "ru")).toBe("мечта");
    expect(pickTagLabel({ ru: "мечта", en: " dream " }, futureLocale)).toBe("dream");
  });

  it("returns an empty string when no usable label exists", () => {
    expect(pickTagLabel({}, "ru")).toBe("");
  });
});

describe("compareTagCatalogSlugs", () => {
  it("orders the starting catalog as dream, need-now, someday", () => {
    const rows = [{ slug: "someday" }, { slug: "dream" }, { slug: "need-now" }];
    expect(rows.sort(compareTagCatalogSlugs).map((row) => row.slug)).toEqual([
      "dream",
      "need-now",
      "someday",
    ]);
  });

  it("returns 0 for equal slugs", () => {
    expect(compareTagCatalogSlugs({ slug: "dream" }, { slug: "dream" })).toBe(0);
  });
});

describe("toTagCatalogItem", () => {
  it("exposes only id, slug and the localized label", () => {
    const row = {
      id: "tag_1",
      slug: "dream",
      labels: { ru: "мечта" },
      aggregateEligible: true,
      customText: "своё",
    };

    expect(toTagCatalogItem(row, "ru")).toEqual({
      id: "tag_1",
      slug: "dream",
      label: "мечта",
    });
  });
});
