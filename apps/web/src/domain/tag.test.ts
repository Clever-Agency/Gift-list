import { describe, expect, it } from "vitest";
import {
  customTagRowIdsToLink,
  groupCustomTagQueue,
  normalizeCustomTagText,
  toGiftTag,
  toGiftTags,
  isGiftTagApprovedForAggregates,
} from "./tag";

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

  it("orders custom tags before fixed tags, each group by its own key", () => {
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
      { catalogId: null, label: "автомобиль" },
      { catalogId: null, label: "яблоко" },
      { catalogId: "tag_dream", label: "мечта" },
      { catalogId: "tag_need_now", label: "нужно сейчас" },
      { catalogId: "tag_someday", label: "когда-нибудь" },
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

  it("sorts an approved custom tag with the fixed catalog tags, after unapproved ones", () => {
    expect(
      toGiftTags(
        [
          { tagId: null, customText: "яблоко", tag: null },
          { tagId: "tag_dream", customText: "мечта", tag: { slug: "dream", labels: { ru: "мечта" } } },
        ],
        "ru",
      ),
    ).toEqual([
      { catalogId: null, label: "яблоко" },
      { catalogId: "tag_dream", label: "мечта" },
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

describe("normalizeCustomTagText", () => {
  it("trims, collapses spaces and lower-cases per the ru locale", () => {
    expect(normalizeCustomTagText("  Айфон   Pro ")).toBe("айфон pro");
    expect(normalizeCustomTagText("АЙФОН")).toBe("айфон");
    expect(normalizeCustomTagText("Ёлка")).toBe("ёлка");
  });

  it("uses NFC so a decomposed spelling matches its composed form", () => {
    expect(normalizeCustomTagText("й".normalize("NFD"))).toBe("й");
  });

  it("returns an empty key for blank text", () => {
    expect(normalizeCustomTagText("   ")).toBe("");
  });
});

describe("groupCustomTagQueue", () => {
  it("groups by the normalized text and counts distinct wishes", () => {
    expect(
      groupCustomTagQueue([
        { giftId: "g1", customText: "Айфон" },
        { giftId: "g1", customText: "айфон" },
        { giftId: "g2", customText: "Айфон" },
        { giftId: "g3", customText: "Ноутбук" },
      ]),
    ).toEqual([
      { normalizedText: "айфон", sampleText: "Айфон", usageCount: 2 },
      { normalizedText: "ноутбук", sampleText: "Ноутбук", usageCount: 1 },
    ]);
  });

  it("leaves out texts that already have a decision", () => {
    expect(
      groupCustomTagQueue(
        [
          { giftId: "g1", customText: "Айфон" },
          { giftId: "g2", customText: "Ноутбук" },
        ],
        ["айфон"],
      ),
    ).toEqual([{ normalizedText: "ноутбук", sampleText: "Ноутбук", usageCount: 1 }]);
  });

  it("orders by usage descending, then by the normalized text", () => {
    expect(
      groupCustomTagQueue([
        { giftId: "g1", customText: "яблоко" },
        { giftId: "g2", customText: "банан" },
        { giftId: "g3", customText: "банан" },
        { giftId: "g4", customText: "арбуз" },
        { giftId: "g5", customText: "арбуз" },
      ]).map((line) => line.normalizedText),
    ).toEqual(["арбуз", "банан", "яблоко"]);
  });

  it("never leaks a wish id or an author into a line", () => {
    const line = groupCustomTagQueue([{ giftId: "g1", customText: "Айфон" }])[0]!;
    expect(Object.keys(line).sort()).toEqual(["normalizedText", "sampleText", "usageCount"]);
  });

  it("ignores null and blank texts", () => {
    expect(
      groupCustomTagQueue([
        { giftId: "g1", customText: null },
        { giftId: "g2", customText: "   " },
      ]),
    ).toEqual([]);
  });
});

describe("customTagRowIdsToLink", () => {
  const rows = [
    { id: "t1", giftId: "g1", customText: "Айфон" },
    { id: "t2", giftId: "g1", customText: "айфон" },
    { id: "t3", giftId: "g2", customText: "Айфон" },
    { id: "t4", giftId: "g3", customText: "Ноутбук" },
    { id: "t5", giftId: "g4", customText: null },
  ];

  it("takes every row of the normalized text, one per wish", () => {
    // g1 has two case variants: only the first is linked, so (giftId, tagId) holds.
    expect(customTagRowIdsToLink(rows, "айфон", new Set())).toEqual(["t1", "t3"]);
  });

  it("skips a wish that already has the catalog tag", () => {
    expect(customTagRowIdsToLink(rows, "айфон", new Set(["g2"]))).toEqual(["t1"]);
  });

  it("ignores other texts and null rows", () => {
    expect(customTagRowIdsToLink(rows, "ноутбук", new Set())).toEqual(["t4"]);
  });

  it("returns no ids when nothing matches", () => {
    expect(customTagRowIdsToLink(rows, "кошка", new Set())).toEqual([]);
  });
});
