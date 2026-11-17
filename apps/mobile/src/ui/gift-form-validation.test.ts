import { GIFT_DESCRIPTION_MAX, GIFT_LINK_URL_MAX, GIFT_TITLE_MAX, textLength } from "@gift-list/contracts";
import { describe, expect, it } from "vitest";
import {
  fieldErrorCopy,
  firstErrorField,
  isHttpUrl,
  serverErrorField,
  tagErrorKey,
  validateGiftForm,
  type GiftFormBaseline,
} from "@/ui/gift-form-validation";

/** The three text fields of a valid form; each test overrides what it checks. */
function form(overrides: Partial<{ title: string; description: string; link: string; price: string }> = {}) {
  return { title: "Наушники", description: "", link: "", price: "", ...overrides };
}

/** A URL of exactly `length` code points: the prefix is part of it. */
function linkOfLength(length: number): string {
  const prefix = "https://example.com/";
  return `${prefix}${"a".repeat(length - prefix.length)}`;
}

describe("validateGiftForm", () => {
  it("accepts empty optional fields", () => {
    expect(validateGiftForm(form())).toEqual({});
    expect(validateGiftForm(form({ link: "   ", price: "250,50" }))).toEqual({});
  });

  it("requires a title that is not only spaces", () => {
    expect(validateGiftForm(form({ title: "" }))).toEqual({ title: true });
    expect(validateGiftForm(form({ title: "  \n " }))).toEqual({ title: true });
  });

  it("rejects a price the parser cannot read", () => {
    expect(validateGiftForm(form({ price: "abc" }))).toEqual({ price: true });
    expect(validateGiftForm(form({ price: "12.345" }))).toEqual({ price: true });
    expect(validateGiftForm(form({ price: "-5" }))).toEqual({ price: true });
  });

  it("rejects a link that is not an absolute http(s) URL", () => {
    for (const link of [
      "example.com",
      "ftp://example.com",
      "javascript:alert(1)",
      "https:/example.com",
      "https://",
    ]) {
      expect(validateGiftForm(form({ link }))).toEqual({ link: true });
    }
  });

  it("reports every invalid field at once", () => {
    expect(
      validateGiftForm(form({ title: " ", link: "nope", price: "x", description: "a".repeat(GIFT_DESCRIPTION_MAX + 1) })),
    ).toEqual({
      title: true,
      description: true,
      link: true,
      price: true,
    });
  });

  /**
   * The caps of `giftInputSchema` are counted in code points, so the form counts
   * the same unit: `String#length` (and every `maxLength`) would measure emoji as
   * two and reject a value the server stores.
   */
  describe("длины в кодовых точках", () => {
    it("название: 120 принимается, 121 — нет (кириллица), 119 — тоже можно", () => {
      expect(validateGiftForm(form({ title: "я".repeat(GIFT_TITLE_MAX - 1) }))).toEqual({});
      expect(validateGiftForm(form({ title: "я".repeat(GIFT_TITLE_MAX) }))).toEqual({});
      expect(validateGiftForm(form({ title: "я".repeat(GIFT_TITLE_MAX + 1) }))).toEqual({
        title: true,
      });
    });

    it("название: 120 эмодзи (240 UTF-16 units) принимаются, 121 — нет", () => {
      const emoji = "🎁";
      expect(emoji.length).toBe(2);
      const accepted = emoji.repeat(GIFT_TITLE_MAX);
      expect(accepted.length).toBe(GIFT_TITLE_MAX * 2);
      expect(validateGiftForm(form({ title: accepted }))).toEqual({});
      expect(validateGiftForm(form({ title: emoji.repeat(GIFT_TITLE_MAX + 1) }))).toEqual({
        title: true,
      });
    });

    it("название: combining-знаки считаются по кодовым точкам, как в схеме", () => {
      const pair = "и\u0306";
      expect(textLength(pair)).toBe(2);
      expect(validateGiftForm(form({ title: pair.repeat(GIFT_TITLE_MAX / 2) }))).toEqual({});
      expect(validateGiftForm(form({ title: pair.repeat(GIFT_TITLE_MAX / 2 + 1) }))).toEqual({
        title: true,
      });
    });

    it("название: внешние пробелы не съедают лимит (trim до проверки)", () => {
      expect(validateGiftForm(form({ title: `  ${"я".repeat(GIFT_TITLE_MAX)}  ` }))).toEqual({});
    });

    it("описание: 2000 принимается, 2001 — нет; 2000 эмодзи тоже принимаются", () => {
      expect(validateGiftForm(form({ description: "я".repeat(GIFT_DESCRIPTION_MAX - 1) }))).toEqual({});
      expect(validateGiftForm(form({ description: "я".repeat(GIFT_DESCRIPTION_MAX) }))).toEqual({});
      expect(validateGiftForm(form({ description: "я".repeat(GIFT_DESCRIPTION_MAX + 1) }))).toEqual({
        description: true,
      });
      expect(
        validateGiftForm(form({ description: "🎁".repeat(GIFT_DESCRIPTION_MAX) })),
      ).toEqual({});
    });

    it("ссылка: 2048 кодовых точек принимается, 2049 — нет", () => {
      expect(validateGiftForm(form({ link: linkOfLength(GIFT_LINK_URL_MAX - 1) }))).toEqual({});
      expect(validateGiftForm(form({ link: linkOfLength(GIFT_LINK_URL_MAX) }))).toEqual({});
      expect(validateGiftForm(form({ link: linkOfLength(GIFT_LINK_URL_MAX + 1) }))).toEqual({
        link: true,
      });
      // The same text in UTF-16 units is longer: a `maxLength` would have cut it.
      const emojiLink = `https://example.com/${"🎁".repeat(2028)}`;
      expect(textLength(emojiLink)).toBe(GIFT_LINK_URL_MAX);
      expect(emojiLink.length).toBeGreaterThan(GIFT_LINK_URL_MAX);
      expect(validateGiftForm(form({ link: emojiLink }))).toEqual({});
    });
  });

  /**
   * Legacy: a stored value longer than the current cap cannot appear through the
   * API, but it is not impossible in the database. An untouched value must not
   * block the owner from changing another field; a changed one is reported.
   */
  describe("сохранённое значение длиннее предела", () => {
    const baseline: GiftFormBaseline = {
      title: "я".repeat(GIFT_TITLE_MAX + 10),
      description: "я".repeat(GIFT_DESCRIPTION_MAX + 10),
      link: linkOfLength(GIFT_LINK_URL_MAX + 10),
    };

    it("нетронутое значение не блокирует отправку", () => {
      expect(validateGiftForm(form(baseline), baseline)).toEqual({});
    });

    it("изменённое значение проверяется как обычно", () => {
      expect(
        validateGiftForm(form({ ...baseline, title: `${baseline.title}я` }), baseline),
      ).toEqual({ title: true });
      expect(
        validateGiftForm(
          form({ title: "Книга", description: `${baseline.description}я`, link: baseline.link }),
          baseline,
        ),
      ).toEqual({ description: true });
    });

    it("значение короче предела проверяется и без baseline", () => {
      expect(validateGiftForm(form(), baseline)).toEqual({});
    });
  });
});

describe("isHttpUrl", () => {
  it("accepts http and https with a host, ignoring outer spaces", () => {
    expect(isHttpUrl("https://example.com")).toBe(true);
    expect(isHttpUrl("http://example.com/path?q=1#x")).toBe(true);
    expect(isHttpUrl("  HTTPS://EXAMPLE.COM  ")).toBe(true);
  });

  it("rejects other protocols and relative links", () => {
    expect(isHttpUrl("ftp://example.com")).toBe(false);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("/u/nick")).toBe(false);
    expect(isHttpUrl("")).toBe(false);
  });
});

describe("firstErrorField", () => {
  it("follows the visual order of the form", () => {
    expect(firstErrorField({})).toBeNull();
    expect(firstErrorField({ price: true, title: true })).toBe("title");
    expect(firstErrorField({ visibility: true, price: true, link: true })).toBe("link");
    expect(firstErrorField({ quantity: true, visibility: true })).toBe("visibility");
    expect(firstErrorField({ quantity: true })).toBe("quantity");
    expect(firstErrorField({ link: true, description: true })).toBe("description");
  });
});

describe("serverErrorField", () => {
  it("maps the contract field names onto the form fields", () => {
    expect(serverErrorField("title")).toBe("title");
    expect(serverErrorField("description")).toBe("description");
    expect(serverErrorField("priceAmount")).toBe("price");
    expect(serverErrorField("priceCurrency")).toBe("price");
    expect(serverErrorField("linkUrl")).toBe("link");
    expect(serverErrorField("visibility")).toBe("visibility");
    expect(serverErrorField("quantity")).toBe("quantity");
    expect(serverErrorField("tags")).toBe("tags");
    expect(serverErrorField("tags.0")).toBe("tags");
    expect(serverErrorField("tags.12.text")).toBe("tags");
    expect(serverErrorField("tags.3.catalogId")).toBe("tags");
  });

  it("has no place for an unknown or missing field", () => {
    expect(serverErrorField(undefined)).toBeNull();
    expect(serverErrorField("")).toBeNull();
    expect(serverErrorField("tagsExtra")).toBeNull();
  });
});

describe("tagErrorKey", () => {
  const submitted = ["catalog:tag_dream", "custom:своё", "catalog:tag_need"];

  it("maps the server index onto the tag that was sent at that position", () => {
    expect(tagErrorKey("tags.0.catalogId", submitted, submitted)).toBe("catalog:tag_dream");
    expect(tagErrorKey("tags.1.text", submitted, submitted)).toBe("custom:своё");
    expect(tagErrorKey("tags.2", submitted, submitted)).toBe("catalog:tag_need");
  });

  it("follows the tag identity after the chips are reordered", () => {
    const reordered = ["catalog:tag_need", "catalog:tag_dream", "custom:своё"];
    expect(tagErrorKey("tags.2.catalogId", submitted, reordered)).toBe("catalog:tag_need");
    expect(tagErrorKey("tags.1.text", submitted, reordered)).toBe("custom:своё");
  });

  it("falls back to the group when the offending tag is gone or the index is stale", () => {
    const withoutCustom = ["catalog:tag_dream", "catalog:tag_need"];
    // A tag removed after the submit: nothing to highlight.
    expect(tagErrorKey("tags.1.text", submitted, withoutCustom)).toBeNull();
    // An index the submitted request never had.
    expect(tagErrorKey("tags.3.text", submitted, submitted)).toBeNull();
    expect(tagErrorKey("tags.99", submitted, submitted)).toBeNull();
    // No submit has happened in this mount yet.
    expect(tagErrorKey("tags.0.text", [], submitted)).toBeNull();
  });

  it("is group-level for a path without an item number", () => {
    expect(tagErrorKey("tags", submitted, submitted)).toBeNull();
    expect(tagErrorKey("tags.", submitted, submitted)).toBeNull();
    expect(tagErrorKey("tags.text", submitted, submitted)).toBeNull();
    expect(tagErrorKey("title", submitted, submitted)).toBeNull();
    expect(tagErrorKey(undefined, submitted, submitted)).toBeNull();
  });
});

describe("fieldErrorCopy", () => {
  it("uses a dedicated gift-form message per field", () => {
    expect(fieldErrorCopy("title")).toEqual({ catalog: "giftForm", key: "error.titleRequired" });
    expect(fieldErrorCopy("description")).toEqual({
      catalog: "giftForm",
      key: "error.descriptionTooLong",
      values: { max: GIFT_DESCRIPTION_MAX },
    });
    expect(fieldErrorCopy("price")).toEqual({ catalog: "giftForm", key: "error.priceInvalid" });
    expect(fieldErrorCopy("link")).toEqual({ catalog: "giftForm", key: "error.linkInvalid" });
  });

  it("falls back to the shared validation sentence", () => {
    expect(fieldErrorCopy("visibility")).toEqual({
      catalog: "common",
      key: "errors.code.VALIDATION",
    });
    expect(fieldErrorCopy("quantity")).toEqual({
      catalog: "giftForm",
      key: "error.quantityLocked",
    });
  });

  it("names the custom tag problem behind a tags error", () => {
    expect(fieldErrorCopy("tags")).toEqual({
      catalog: "giftForm",
      key: "error.tags",
      values: { max: 30 },
    });
    expect(fieldErrorCopy("tags", { tagIssue: "empty" })).toEqual({
      catalog: "giftForm",
      key: "error.tagEmpty",
    });
    expect(fieldErrorCopy("tags", { tagIssue: "duplicate" })).toEqual({
      catalog: "giftForm",
      key: "error.tagDuplicate",
    });
    expect(fieldErrorCopy("tags", { tagIssue: "invalid" })).toEqual({
      catalog: "giftForm",
      key: "error.tagInvalid",
    });
    expect(fieldErrorCopy("tags", { tagIssue: "tooLong" })).toEqual({
      catalog: "giftForm",
      key: "error.tagTooLong",
      values: { max: 30 },
    });
    expect(fieldErrorCopy("tags", { tagServerField: "tags.0.catalogId" })).toEqual({
      catalog: "giftForm",
      key: "error.tagUnavailable",
    });
  });

  it("reads a server title error as too long only past the title cap", () => {
    const tooLong = {
      catalog: "giftForm",
      key: "error.titleTooLong",
      values: { max: GIFT_TITLE_MAX },
    };
    const required = { catalog: "giftForm", key: "error.titleRequired" };

    expect(fieldErrorCopy("title", { title: "я".repeat(GIFT_TITLE_MAX + 1) })).toEqual(tooLong);
    // Trimmed first: outer spaces do not make a short title too long.
    expect(fieldErrorCopy("title", { title: `  ${"я".repeat(GIFT_TITLE_MAX)}  ` })).toEqual(required);
    expect(fieldErrorCopy("title", { title: "" })).toEqual(required);
    expect(fieldErrorCopy("title", {})).toEqual(required);
  });

  it("counts a title in code points, so 120 emoji are not too long", () => {
    expect(fieldErrorCopy("title", { title: "🎁".repeat(GIFT_TITLE_MAX) })).toEqual({
      catalog: "giftForm",
      key: "error.titleRequired",
    });
    expect(fieldErrorCopy("title", { title: "🎁".repeat(GIFT_TITLE_MAX + 1) })).toEqual({
      catalog: "giftForm",
      key: "error.titleTooLong",
      values: { max: GIFT_TITLE_MAX },
    });
  });

  it("words a server link error as too long past the cap, invalid otherwise", () => {
    const tooLong = {
      catalog: "giftForm",
      key: "error.linkTooLong",
      values: { max: GIFT_LINK_URL_MAX },
    };
    expect(fieldErrorCopy("link", { link: linkOfLength(GIFT_LINK_URL_MAX + 1) })).toEqual(tooLong);
    expect(fieldErrorCopy("link", { link: linkOfLength(GIFT_LINK_URL_MAX) })).toEqual({
      catalog: "giftForm",
      key: "error.linkInvalid",
    });
    expect(fieldErrorCopy("link", { link: "example.com" })).toEqual({
      catalog: "giftForm",
      key: "error.linkInvalid",
    });
  });

  it("keeps the other fields independent of the title and link values", () => {
    expect(
      fieldErrorCopy("price", {
        title: "я".repeat(GIFT_TITLE_MAX + 1),
        link: linkOfLength(GIFT_LINK_URL_MAX + 1),
      }),
    ).toEqual({ catalog: "giftForm", key: "error.priceInvalid" });
  });
});
