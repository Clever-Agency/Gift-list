import { describe, expect, it } from "vitest";
import { CURRENCIES, QUANTITIES, VISIBILITIES } from "./enums";
import { GIFT_TAG_TEXT_MAX, giftInputSchema, giftUpdateSchema } from "./gift";

describe("giftInputSchema", () => {
  it("fills an empty body with nulls and PUBLIC visibility", () => {
    expect(giftInputSchema.parse({ title: "Книга" })).toEqual({
      title: "Книга",
      description: null,
      priceAmount: null,
      priceCurrency: null,
      linkUrl: null,
      visibility: "PUBLIC",
      quantity: "SINGLE",
      tags: [],
    });
  });

  it("trims the title", () => {
    expect(giftInputSchema.parse({ title: "  Книга  " }).title).toBe("Книга");
  });

  it("rejects a missing, empty or blank title", () => {
    for (const body of [{ title: "" }, { title: "   " }, {}]) {
      const parsed = giftInputSchema.safeParse(body);
      expect(parsed.success).toBe(false);
      if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(["title"]);
    }
  });

  it("rejects a title over the cap", () => {
    expect(giftInputSchema.safeParse({ title: "x".repeat(120) }).success).toBe(true);
    expect(giftInputSchema.safeParse({ title: "x".repeat(121) }).success).toBe(false);
  });

  it("defaults the currency to USD when only the amount is set", () => {
    const parsed = giftInputSchema.parse({ title: "Книга", priceAmount: 12_50 });
    expect(parsed.priceAmount).toBe(12_50);
    expect(parsed.priceCurrency).toBe("USD");
  });

  it.each(CURRENCIES)("keeps the %s currency with an amount", (currency) => {
    const parsed = giftInputSchema.parse({ title: "Книга", priceAmount: 100, priceCurrency: currency });
    expect(parsed.priceCurrency).toBe(currency);
  });

  it("drops the currency when no amount is set", () => {
    const parsed = giftInputSchema.parse({ title: "Книга", priceCurrency: "EUR" });
    expect(parsed.priceAmount).toBeNull();
    expect(parsed.priceCurrency).toBeNull();
  });

  it("rejects a currency outside the list", () => {
    expect(giftInputSchema.safeParse({ title: "Книга", priceAmount: 100, priceCurrency: "GBP" }).success).toBe(
      false,
    );
  });

  it.each([-1, 12.5, "100"])("rejects a negative, fractional or non-number amount: %j", (priceAmount) => {
    const parsed = giftInputSchema.safeParse({ title: "Книга", priceAmount });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(["priceAmount"]);
  });

  it("turns blank description and link into null", () => {
    for (const blank of ["", "   "]) {
      const parsed = giftInputSchema.parse({ title: "Книга", description: blank, linkUrl: blank });
      expect(parsed.description).toBeNull();
      expect(parsed.linkUrl).toBeNull();
    }
  });

  it.each(["javascript:alert(1)", "ftp://example.com/item", "example.com/item"])(
    "rejects a link that is not http(s): %j",
    (linkUrl) => {
      const parsed = giftInputSchema.safeParse({ title: "Книга", linkUrl });
      expect(parsed.success).toBe(false);
      if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(["linkUrl"]);
    },
  );

  it("keeps a valid https link", () => {
    expect(giftInputSchema.parse({ title: "Книга", linkUrl: "https://example.com/item?x=1" }).linkUrl).toBe(
      "https://example.com/item?x=1",
    );
  });

  it.each(VISIBILITIES)("accepts the %s visibility", (visibility) => {
    expect(giftInputSchema.parse({ title: "Книга", visibility }).visibility).toBe(visibility);
  });

  it("defaults the quantity to SINGLE", () => {
    expect(giftInputSchema.parse({ title: "Книга" }).quantity).toBe("SINGLE");
  });

  it.each(QUANTITIES)("accepts the %s quantity", (quantity) => {
    expect(giftInputSchema.parse({ title: "Книга", quantity }).quantity).toBe(quantity);
  });

  it("rejects a quantity outside the list", () => {
    const parsed = giftInputSchema.safeParse({ title: "Книга", quantity: "MANY" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(["quantity"]);
  });

  it("rejects keys outside the body", () => {
    expect(giftInputSchema.safeParse({ title: "Книга", bought: true }).success).toBe(false);
  });
});

describe("gift tags", () => {
  it("defaults a create body to no tags", () => {
    expect(giftInputSchema.parse({ title: "Книга" }).tags).toEqual([]);
  });

  it("accepts a catalog tag by id and a custom tag by text", () => {
    expect(
      giftInputSchema.parse({
        title: "Книга",
        tags: [{ catalogId: "tag_1" }, { text: "  для дома  " }],
      }).tags,
    ).toEqual([{ catalogId: "tag_1" }, { text: "для дома" }]);
  });

  it("trims a custom tag and rejects an empty or blank one", () => {
    expect(giftInputSchema.parse({ title: "Книга", tags: [{ text: "  мечта  " }] }).tags).toEqual([
      { text: "мечта" },
    ]);

    for (const text of ["", "   "]) {
      expect(giftInputSchema.safeParse({ title: "Книга", tags: [{ text }] }).success).toBe(false);
    }
  });

  it("counts custom tag length in Unicode code points", () => {
    const atLimit = "😀".repeat(GIFT_TAG_TEXT_MAX);
    const overLimit = "😀".repeat(GIFT_TAG_TEXT_MAX + 1);

    // A surrogate pair is two JS units but one code point, like PostgreSQL's VARCHAR.
    expect(atLimit.length).toBeGreaterThan(GIFT_TAG_TEXT_MAX);
    expect(giftInputSchema.safeParse({ title: "Книга", tags: [{ text: atLimit }] }).success).toBe(
      true,
    );
    expect(
      giftInputSchema.safeParse({ title: "Книга", tags: [{ text: overLimit }] }).success,
    ).toBe(false);
  });

  it("rejects a tag with both sources or with neither", () => {
    for (const tag of [{ catalogId: "tag_1", text: "свой" }, {}]) {
      expect(giftInputSchema.safeParse({ title: "Книга", tags: [tag] }).success).toBe(false);
    }
  });

  it("rejects an empty catalog id", () => {
    expect(
      giftInputSchema.safeParse({ title: "Книга", tags: [{ catalogId: "   " }] }).success,
    ).toBe(false);
  });

  it("rejects NUL, which PostgreSQL cannot store in a VARCHAR", () => {
    expect(
      giftInputSchema.safeParse({ title: "Книга", tags: [{ text: "свой\u0000тег" }] }).success,
    ).toBe(false);
  });

  it("rejects duplicate catalog ids and duplicate custom texts", () => {
    const duplicates = [
      [{ catalogId: "tag_1" }, { catalogId: "tag_1" }],
      [{ text: "мечта" }, { text: "мечта" }],
      [{ text: " мечта " }, { text: "мечта" }],
    ];

    for (const tags of duplicates) {
      const parsed = giftInputSchema.safeParse({ title: "Книга", tags });
      expect(parsed.success).toBe(false);
      if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(["tags"]);
    }
  });

  it("keeps a catalog id and an equal custom text apart", () => {
    expect(
      giftInputSchema.safeParse({
        title: "Книга",
        tags: [{ catalogId: "dream" }, { text: "dream" }],
      }).success,
    ).toBe(true);
  });

  it("never lets a client set aggregate eligibility or moderation fields", () => {
    for (const tag of [
      { catalogId: "tag_1", aggregateEligible: true },
      { text: "свой", aggregateEligible: true },
      { text: "свой", tagId: "tag_1" },
    ]) {
      expect(giftInputSchema.safeParse({ title: "Книга", tags: [tag] }).success).toBe(false);
    }
  });

  it("accepts an explicit empty list in a create body", () => {
    expect(giftInputSchema.parse({ title: "Книга", tags: [] }).tags).toEqual([]);
  });

  it("keeps tags out of an edit body that omits them", () => {
    expect(giftUpdateSchema.parse({ description: "Заметка" })).not.toHaveProperty("tags");
  });

  it("carries omitted, cleared and replaced tags into an edit body", () => {
    expect(giftUpdateSchema.parse({ tags: [] })).toEqual({ tags: [] });
    expect(giftUpdateSchema.parse({ tags: [{ catalogId: "tag_1" }] })).toEqual({
      tags: [{ catalogId: "tag_1" }],
    });
    expect(giftUpdateSchema.parse({ tags: [{ text: " свой " }] })).toEqual({
      tags: [{ text: "свой" }],
    });
  });

  it("applies the same tag rules to an edit body", () => {
    for (const tags of [[{ text: "   " }], [{ text: "😀".repeat(GIFT_TAG_TEXT_MAX + 1) }], [{ catalogId: "tag_1", aggregateEligible: true }]]) {
      expect(giftUpdateSchema.safeParse({ tags }).success).toBe(false);
    }
  });
});

describe("giftUpdateSchema", () => {
  it("keeps only the keys that came in", () => {
    expect(giftUpdateSchema.parse({ title: "Книга" })).toEqual({ title: "Книга" });
    expect(giftUpdateSchema.parse({ visibility: "SECRET" })).toEqual({ visibility: "SECRET" });
    expect(giftUpdateSchema.parse({ description: "  Заметка  " })).toEqual({ description: "Заметка" });
  });

  it("rejects an empty body", () => {
    const parsed = giftUpdateSchema.safeParse({});
    expect(parsed.success).toBe(false);
  });

  it("trims the title and rejects a blank or empty one", () => {
    expect(giftUpdateSchema.parse({ title: "  Книга  " })).toEqual({ title: "Книга" });

    for (const title of ["", "   "]) {
      const parsed = giftUpdateSchema.safeParse({ title });
      expect(parsed.success).toBe(false);
      if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(["title"]);
    }
  });

  it("rejects a null or over-long title", () => {
    for (const title of [null, "x".repeat(121)]) {
      const parsed = giftUpdateSchema.safeParse({ title });
      expect(parsed.success).toBe(false);
      if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(["title"]);
    }
    expect(giftUpdateSchema.safeParse({ title: "x".repeat(120) }).success).toBe(true);
  });

  it.each([
    ["description", ""],
    ["description", "   "],
    ["linkUrl", ""],
  ] as const)("turns a blank %s into null", (field, blank) => {
    expect(giftUpdateSchema.parse({ [field]: blank })).toEqual({ [field]: null });
  });

  it("clears description and link with an explicit null", () => {
    expect(giftUpdateSchema.parse({ description: null, linkUrl: null })).toEqual({
      description: null,
      linkUrl: null,
    });
  });

  it.each(["javascript:alert(1)", "ftp://example.com/item", "example.com/item"])(
    "rejects a link that is not http(s): %j",
    (linkUrl) => {
      const parsed = giftUpdateSchema.safeParse({ linkUrl });
      expect(parsed.success).toBe(false);
      if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(["linkUrl"]);
    },
  );

  it("defaults the currency to USD when the amount is set without one", () => {
    expect(giftUpdateSchema.parse({ priceAmount: 12_50 })).toEqual({
      priceAmount: 12_50,
      priceCurrency: "USD",
    });
  });

  it.each(CURRENCIES)("keeps the %s currency with an amount", (currency) => {
    expect(giftUpdateSchema.parse({ priceAmount: 100, priceCurrency: currency })).toEqual({
      priceAmount: 100,
      priceCurrency: currency,
    });
  });

  it("clears both price fields when the amount is set to null", () => {
    expect(giftUpdateSchema.parse({ priceAmount: null })).toEqual({
      priceAmount: null,
      priceCurrency: null,
    });
    expect(giftUpdateSchema.parse({ priceAmount: null, priceCurrency: "EUR" })).toEqual({
      priceAmount: null,
      priceCurrency: null,
    });
  });

  it("keeps a lone currency for the use-case to combine with the stored amount", () => {
    expect(giftUpdateSchema.parse({ priceCurrency: "EUR" })).toEqual({ priceCurrency: "EUR" });
    expect(giftUpdateSchema.parse({ priceCurrency: null })).toEqual({ priceCurrency: null });
  });

  it.each([-1, 12.5, "100"])("rejects a negative, fractional or non-number amount: %j", (priceAmount) => {
    const parsed = giftUpdateSchema.safeParse({ priceAmount });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(["priceAmount"]);
  });

  it("rejects a currency outside the list", () => {
    expect(giftUpdateSchema.safeParse({ priceCurrency: "GBP" }).success).toBe(false);
  });

  it.each(VISIBILITIES)("accepts the %s visibility without defaulting it", (visibility) => {
    expect(giftUpdateSchema.parse({ visibility })).toEqual({ visibility });
  });

  it.each(QUANTITIES)("accepts the %s quantity without defaulting it", (quantity) => {
    expect(giftUpdateSchema.parse({ quantity })).toEqual({ quantity });
  });

  it("does not add a default quantity to a body without it", () => {
    expect(giftUpdateSchema.parse({ description: "Заметка" })).not.toHaveProperty("quantity");
  });

  it("rejects a quantity outside the list", () => {
    const parsed = giftUpdateSchema.safeParse({ quantity: "MANY" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(["quantity"]);
  });

  it("does not add a default visibility to a body without it", () => {
    expect(giftUpdateSchema.parse({ description: "Заметка" })).not.toHaveProperty("visibility");
  });

  it("rejects keys outside the body", () => {
    expect(giftUpdateSchema.safeParse({ description: "Заметка", bought: true }).success).toBe(false);
    expect(giftUpdateSchema.safeParse({ bought: true }).success).toBe(false);
  });
});
