import type { GiftCard } from "@gift-list/contracts";
import { describe, expect, it } from "vitest";
import { hasWishVisibleToEveryone } from "@/wishlist/share-availability";

function gift(overrides: Partial<GiftCard> = {}): GiftCard {
  return {
    id: "g1",
    title: "Наушники",
    description: null,
    priceAmount: null,
    priceCurrency: null,
    linkUrl: null,
    visibility: "PUBLIC",
    quantity: "SINGLE",
    expiresOn: null,
    archivedAt: null,
    tags: [],
    status: "OPEN",
    reservedBy: null,
    reservationLabel: null,
    ownerAction: null,
    ...overrides,
  };
}

describe("hasWishVisibleToEveryone", () => {
  it("пустой список не даёт ссылке смысла", () => {
    expect(hasWishVisibleToEveryone([])).toBe(false);
  });

  it("только FRIENDS и SECRET — нечего показывать всем", () => {
    expect(
      hasWishVisibleToEveryone([
        gift({ visibility: "FRIENDS" }),
        gift({ id: "g2", visibility: "SECRET" }),
      ]),
    ).toBe(false);
  });

  it("архивное PUBLIC скрыто от всех, кроме владельца", () => {
    expect(
      hasWishVisibleToEveryone([
        gift({ archivedAt: "2026-10-01T00:00:00.000Z" }),
        gift({ id: "g2", visibility: "FRIENDS" }),
      ]),
    ).toBe(false);
  });

  it("одно неархивное PUBLIC включает ссылку", () => {
    expect(
      hasWishVisibleToEveryone([
        gift({ visibility: "SECRET" }),
        gift({ id: "g2", visibility: "PUBLIC" }),
      ]),
    ).toBe(true);
  });

  it("архивное PUBLIC рядом с живым PUBLIC всё равно включает ссылку", () => {
    expect(
      hasWishVisibleToEveryone([
        gift({ archivedAt: "2026-10-01T00:00:00.000Z" }),
        gift({ id: "g2", visibility: "PUBLIC" }),
      ]),
    ).toBe(true);
  });

  it("резерв и закрытие не прячут PUBLIC из публичного списка", () => {
    expect(
      hasWishVisibleToEveryone([
        gift({ status: "RESERVED" }),
        gift({ id: "g2", status: "CLOSED" }),
      ]),
    ).toBe(true);
  });
});
