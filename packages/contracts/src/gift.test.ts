import { describe, expect, it } from "vitest";
import { CURRENCIES, VISIBILITIES } from "./enums";
import { giftInputSchema } from "./gift";

describe("giftInputSchema", () => {
  it("fills an empty body with nulls and PUBLIC visibility", () => {
    expect(giftInputSchema.parse({ title: "Книга" })).toEqual({
      title: "Книга",
      description: null,
      priceAmount: null,
      priceCurrency: null,
      linkUrl: null,
      visibility: "PUBLIC",
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

  it("rejects keys outside the body", () => {
    expect(giftInputSchema.safeParse({ title: "Книга", bought: true }).success).toBe(false);
  });
});
