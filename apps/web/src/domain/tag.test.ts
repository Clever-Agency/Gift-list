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
      toGiftTag({ tagId: "tag_dream", customText: null, tag: { labels: { ru: "мечта" } } }, "ru"),
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
      toGiftTag({ tagId: "tag_dream", customText: "мечта", tag: { labels: { ru: "мечта" } } }, "ru"),
    ).toEqual({ catalogId: "tag_dream", label: "мечта" });
  });

  it("drops a row without a usable label", () => {
    expect(toGiftTag({ tagId: "tag_x", customText: null, tag: { labels: {} } }, "ru")).toBeNull();
    expect(toGiftTag({ tagId: "tag_x", customText: null, tag: null }, "ru")).toBeNull();
    expect(toGiftTag({ tagId: null, customText: "   ", tag: null }, "ru")).toBeNull();
  });

  it("exposes only the safe wire fields", () => {
    const tag = toGiftTag(
      {
        tagId: "tag_dream",
        customText: null,
        tag: { labels: { ru: "мечта" } },
      },
      "ru",
    );

    expect(Object.keys(tag ?? {}).sort()).toEqual(["catalogId", "label"]);
    expect(tag).not.toHaveProperty("aggregateEligible");
    expect(tag).not.toHaveProperty("tagId");
  });

  it("keeps row order and leaves unusable rows out", () => {
    expect(
      toGiftTags(
        [
          { tagId: "tag_dream", customText: null, tag: { labels: { ru: "мечта" } } },
          { tagId: "tag_x", customText: null, tag: { labels: {} } },
          { tagId: null, customText: "своё", tag: null },
        ],
        "ru",
      ),
    ).toEqual([
      { catalogId: "tag_dream", label: "мечта" },
      { catalogId: null, label: "своё" },
    ]);
  });
});
