import { describe, expect, it } from "vitest";

import {
  GIFT_EDIT_EVENT_FIELDS,
  changedGiftFields,
  type GiftEditComparable,
} from "./gift-edit";

/** The stored values of a wish with a price, so each case changes one thing. */
function stored(overrides: Partial<GiftEditComparable> = {}): GiftEditComparable {
  return {
    title: "Книга",
    description: "Подарочное издание",
    linkUrl: "https://example.com/book",
    priceAmount: 1000,
    priceCurrency: "RUB",
    ...overrides,
  };
}

describe("GIFT_EDIT_EVENT_FIELDS", () => {
  /** FR-31: a closed set of names, in a fixed order, and `price` is one field. */
  it("names exactly the four significant fields in a stable order", () => {
    expect([...GIFT_EDIT_EVENT_FIELDS]).toEqual(["title", "description", "linkUrl", "price"]);
  });
});

describe("changedGiftFields", () => {
  it("answers nothing when the stored values are resent unchanged", () => {
    expect(changedGiftFields(stored(), stored())).toEqual([]);
  });

  it.each([
    ["title", { title: "Другая книга" }, "title"],
    ["description", { description: "Другое описание" }, "description"],
    ["linkUrl", { linkUrl: "https://example.com/other" }, "linkUrl"],
  ] as const)("reports a changed %s by name only", (_label, after, field) => {
    expect(changedGiftFields(stored(), stored(after))).toEqual([field]);
  });

  it("reports a changed amount as the single field `price`", () => {
    expect(changedGiftFields(stored(), stored({ priceAmount: 1500 }))).toEqual(["price"]);
  });

  it("reports a changed currency as the single field `price`", () => {
    expect(changedGiftFields(stored(), stored({ priceCurrency: "BYN" }))).toEqual(["price"]);
  });

  it("reports both halves of the price pair as one field", () => {
    expect(
      changedGiftFields(stored(), stored({ priceAmount: 1500, priceCurrency: "BYN" })),
    ).toEqual(["price"]);
  });

  it("treats a value and null as different", () => {
    expect(changedGiftFields(stored(), stored({ description: null }))).toEqual(["description"]);
    expect(changedGiftFields(stored({ description: null }), stored())).toEqual(["description"]);
    expect(changedGiftFields(stored(), stored({ linkUrl: null, priceAmount: null }))).toEqual([
      "linkUrl",
      "price",
    ]);
  });

  it("reports a wish that had no price and got one", () => {
    expect(
      changedGiftFields(
        stored({ priceAmount: null, priceCurrency: null }),
        stored({ priceAmount: 1000, priceCurrency: "USD" }),
      ),
    ).toEqual(["price"]);
  });

  /** AD-25: an empty price never compares equal to a priced one, currency included. */
  it("compares the pair, so the same amount in another currency is a change", () => {
    expect(
      changedGiftFields(
        stored({ priceAmount: 1000, priceCurrency: "RUB" }),
        stored({ priceAmount: 1000, priceCurrency: "USD" }),
      ),
    ).toEqual(["price"]);
  });

  /**
   * Only the four significant fields are read: a PATCH that changes tags,
   * `expiresOn`, `visibility` or `quantity` reports nothing.
   */
  it("ignores the fields that are not significant", () => {
    const before = { ...stored(), tags: [], expiresOn: null, visibility: "PUBLIC" };
    const after = {
      ...stored(),
      tags: ["tag_dream"],
      expiresOn: new Date("2026-12-01T00:00:00.000Z"),
      visibility: "SECRET",
      quantity: "UNLIMITED",
    };

    expect(changedGiftFields(before, after)).toEqual([]);
  });

  it("reports every changed field in the order of the closed set", () => {
    expect(
      changedGiftFields(
        stored(),
        stored({
          priceCurrency: "BYN",
          linkUrl: "https://example.com/new",
          description: null,
          title: "Новая книга",
        }),
      ),
    ).toEqual(["title", "description", "linkUrl", "price"]);
  });

  it("does not mutate the compared rows", () => {
    const before = stored();
    const after = stored({ title: "Новая книга" });

    changedGiftFields(before, after);

    expect(before.title).toBe("Книга");
    expect(after.title).toBe("Новая книга");
  });
});
