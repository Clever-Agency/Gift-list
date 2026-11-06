import { describe, expect, it } from "vitest";
import { toGiftTag, toGiftTags, isGiftTagApprovedForAggregates } from "./tag";

describe("isGiftTagApprovedForAggregates", () => {
  it("includes a fixed catalog tag", () => {
    expect(isGiftTagApprovedForAggregates({ tagId: "tag_1", aggregateEligible: true })).toBe(true);
  });

  it("excludes a custom tag that ADMIN has not approved", () => {
    expect(isGiftTagApprovedForAggregates({ tagId: null, aggregateEligible: false })).toBe(false);
  });

  it("excludes a catalog tag not marked eligible", () => {
    expect(isGiftTagApprovedForAggregates({ tagId: "tag_1", aggregateEligible: false })).toBe(
      false,
    );
  });

  it("excludes an eligible flag without a catalog link", () => {
    expect(isGiftTagApprovedForAggregates({ tagId: null, aggregateEligible: true })).toBe(false);
  });
});

describe("toGiftTag", () => {
  it("resolves a fixed tag's label on the server", () => {
    expect(
      toGiftTag({ tagId: "tag_dream", customText: null, tag: { slug: "dream", labels: { ru: "мечта" } } }, "ru"),
    ).toEqual({ catalogId: "tag_dream", label: "мечта" });
  });

  it("shows a custom tag's own text without translation", () => {
    expect(toGiftTag({ tagId: null, customText: "своё", tag: null }, "ru")).toEqual({
      catalogId: null,
      label: "своё",
    });
  });

  it("prefers the catalog label of an approved custom tag", () => {
    expect(
      toGiftTag({ tagId: "tag_dream", customText: "мечта", tag: { slug: "dream", labels: { ru: "мечта" } } }, "ru"),
    ).toEqual({ catalogId: "tag_dream", label: "мечта" });
  });

  it("drops a row without a usable label", () => {
    expect(toGiftTag({ tagId: "tag_x", customText: null, tag: { slug: "x", labels: {} } }, "ru")).toBeNull();
    expect(toGiftTag({ tagId: "tag_x", customText: null, tag: null }, "ru")).toBeNull();
    expect(toGiftTag({ tagId: null, customText: "   ", tag: null }, "ru")).toBeNull();
  });

  it("exposes only the safe wire fields", () => {
    const tag = toGiftTag(
      {
        tagId: "tag_dream",
        customText: null,
        tag: { slug: "dream", labels: { ru: "мечта" } },
      },
      "ru",
    );

    expect(Object.keys(tag ?? {}).sort()).toEqual(["catalogId", "label"]);
    expect(tag).not.toHaveProperty("aggregateEligible");
    expect(tag).not.toHaveProperty("tagId");
  });

  it("orders fixed tags by catalog slug and custom tags by text", () => {
    expect(
      toGiftTags(
        [
          { tagId: "tag_someday", customText: null, tag: { slug: "someday", labels: { ru: "когда-нибудь" } } },
          { tagId: null, customText: "яблоко", tag: null },
          { tagId: "tag_dream", customText: null, tag: { slug: "dream", labels: { ru: "мечта" } } },
          { tagId: null, customText: "автомобиль", tag: null },
          { tagId: "tag_need_now", customText: null, tag: { slug: "need-now", labels: { ru: "нужно сейчас" } } },
        ],
        "ru",
      ),
    ).toEqual([
      { catalogId: "tag_dream", label: "мечта" },
      { catalogId: "tag_need_now", label: "нужно сейчас" },
      { catalogId: "tag_someday", label: "когда-нибудь" },
      { catalogId: null, label: "автомобиль" },
      { catalogId: null, label: "яблоко" },
    ]);
  });

  /** Story 2.5.7: the order must not depend on `createdAt`/`id` of the join rows. */
  it("does not depend on the insertion order", () => {
    const rows = [
      { tagId: "tag_need_now", customText: null, tag: { slug: "need-now", labels: { ru: "нужно сейчас" } } },
      { tagId: null, customText: "яблоко", tag: null },
      { tagId: "tag_dream", customText: null, tag: { slug: "dream", labels: { ru: "мечта" } } },
      { tagId: null, customText: "автомобиль", tag: null },
    ];

    const reversed = [...rows].reverse();

    expect(toGiftTags(rows, "ru")).toEqual(toGiftTags(reversed, "ru"));
  });

  it("sorts text by Unicode code units, not by locale collation", () => {
    // `Intl.Collator("ru")` puts «айфон» before «iPhone»; code units put «I» first.
    expect(
      toGiftTags(
        [
          { tagId: null, customText: "айфон", tag: null },
          { tagId: null, customText: "iPhone", tag: null },
        ],
        "ru",
      ),
    ).toEqual([
      { catalogId: null, label: "iPhone" },
      { catalogId: null, label: "айфон" },
    ]);
  });

  it("sorts an approved custom tag as a fixed catalog tag", () => {
    expect(
      toGiftTags(
        [
          { tagId: null, customText: "яблоко", tag: null },
          { tagId: "tag_dream", customText: "мечта", tag: { slug: "dream", labels: { ru: "мечта" } } },
        ],
        "ru",
      ),
    ).toEqual([
      { catalogId: "tag_dream", label: "мечта" },
      { catalogId: null, label: "яблоко" },
    ]);
  });

  it("leaves unusable rows out of the ordered list", () => {
    expect(
      toGiftTags(
        [
          { tagId: "tag_x", customText: null, tag: { slug: "x", labels: {} } },
          { tagId: "tag_dream", customText: null, tag: { slug: "dream", labels: { ru: "мечта" } } },
          { tagId: null, customText: "   ", tag: null },
        ],
        "ru",
      ),
    ).toEqual([{ catalogId: "tag_dream", label: "мечта" }]);
  });
});
