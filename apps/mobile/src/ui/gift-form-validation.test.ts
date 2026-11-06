import { describe, expect, it } from "vitest";
import {
  DESCRIPTION_MAX,
  TITLE_MAX,
  fieldErrorCopy,
  firstErrorField,
  isHttpUrl,
  serverErrorField,
  tagErrorKey,
  validateGiftForm,
} from "@/ui/gift-form-validation";

describe("validateGiftForm", () => {
  it("accepts empty optional fields", () => {
    expect(validateGiftForm({ title: "Наушники", link: "", price: "" })).toEqual({});
    expect(validateGiftForm({ title: "Наушники", link: "   ", price: "250,50" })).toEqual({});
  });

  it("requires a title that is not only spaces", () => {
    expect(validateGiftForm({ title: "", link: "", price: "" })).toEqual({ title: true });
    expect(validateGiftForm({ title: "  \n ", link: "", price: "" })).toEqual({ title: true });
  });

  it("rejects a price the parser cannot read", () => {
    expect(validateGiftForm({ title: "t", link: "", price: "abc" })).toEqual({ price: true });
    expect(validateGiftForm({ title: "t", link: "", price: "12.345" })).toEqual({ price: true });
    expect(validateGiftForm({ title: "t", link: "", price: "-5" })).toEqual({ price: true });
  });

  it("rejects a link that is not an absolute http(s) URL", () => {
    for (const link of [
      "example.com",
      "ftp://example.com",
      "javascript:alert(1)",
      "https:/example.com",
      "https://",
    ]) {
      expect(validateGiftForm({ title: "t", link, price: "" })).toEqual({ link: true });
    }
  });

  it("reports every invalid field at once", () => {
    expect(validateGiftForm({ title: " ", link: "nope", price: "x" })).toEqual({
      title: true,
      link: true,
      price: true,
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
      values: { max: DESCRIPTION_MAX },
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
    const tooLong = { catalog: "giftForm", key: "error.titleTooLong", values: { max: TITLE_MAX } };
    const required = { catalog: "giftForm", key: "error.titleRequired" };

    expect(fieldErrorCopy("title", { title: "я".repeat(TITLE_MAX + 1) })).toEqual(tooLong);
    // Trimmed first: outer spaces do not make a short title too long.
    expect(fieldErrorCopy("title", { title: `  ${"я".repeat(TITLE_MAX)}  ` })).toEqual(required);
    expect(fieldErrorCopy("title", { title: "" })).toEqual(required);
    expect(fieldErrorCopy("title", {})).toEqual(required);
  });

  it("keeps the other fields independent of the title value", () => {
    expect(fieldErrorCopy("price", { title: "я".repeat(TITLE_MAX + 1) })).toEqual({
      catalog: "giftForm",
      key: "error.priceInvalid",
    });
  });
});
