import { describe, expect, it } from "vitest";
import { CURRENCIES, QUANTITIES, VISIBILITIES } from "./enums";
import { giftInputSchema, giftUpdateSchema } from "./gift";

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
