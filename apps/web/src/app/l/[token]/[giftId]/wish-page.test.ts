import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { loadLinkPage } = vi.hoisted(() => ({ loadLinkPage: vi.fn() }));

vi.mock("../link-page", () => ({ loadLinkPage }));

import { PRODUCT_NAME, type GiftCard } from "@gift-list/contracts";
import { buildWishMetadata, loadWishPage } from "./wish-page";

function card(overrides: Partial<GiftCard> & Pick<GiftCard, "id" | "title">): GiftCard {
  return {
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

const owner = { displayName: "Анна", nick: "anna" };
const publicWish = card({ id: "g-open", title: "Плед" });

function giftsPage(cards: GiftCard[]) {
  return { locale: "ru", view: { kind: "gifts", owner, gifts: cards } };
}

beforeEach(() => {
  loadLinkPage.mockReset();
});

describe("loadWishPage: одно желание того же списка", () => {
  it("возвращает запрошенное желание и владельца из того же чтения, что и /l", async () => {
    loadLinkPage.mockResolvedValue(giftsPage([publicWish, card({ id: "g-two", title: "Свитер" })]));

    const page = await loadWishPage("tok-1", "g-open");

    expect(page.locale).toBe("ru");
    expect(page.view).toEqual({ kind: "wish", owner, gift: publicWish });
    expect(page.listPath).toBe("/l/tok-1");
    expect(page.wishlistPath).toBe("/wishlist/tok-1");
    expect(loadLinkPage).toHaveBeenCalledWith("tok-1", "g-open");
  });

  it("отвечает not_found, если в ответе списка нет запрошенного желания", async () => {
    loadLinkPage.mockResolvedValue(giftsPage([publicWish]));

    const page = await loadWishPage("tok-1", "g-foreign");

    expect(page.view).toEqual({ kind: "not_found" });
  });

  it("отвечает not_found на закрытое желание, которого нет в разрешённом наборе", async () => {
    // The gate never returns FRIENDS, SECRET and archived wishes, so the page
    // cannot tell a closed id from an unknown one (AD-7, AD-15 (14)).
    loadLinkPage.mockResolvedValue(giftsPage([]));

    const page = await loadWishPage("tok-1", "g-secret");

    expect(page.view).toEqual({ kind: "not_found" });
  });

  it("отвечает not_found на неизвестный токен, block и кривой сегмент", async () => {
    loadLinkPage.mockResolvedValue({ locale: "ru", view: { kind: "not_found" } });

    const page = await loadWishPage("tok-1", "g-open");

    expect(page.view).toEqual({ kind: "not_found" });
    expect(page.listPath).toBe("/l/tok-1");
  });

  it("уводит сессию на страницу желания приложения вместе с токеном списка", async () => {
    loadLinkPage.mockResolvedValue({ locale: "ru", view: { kind: "redirect", to: "/wishlist/tok-1" } });

    const page = await loadWishPage("tok-1", "g-open");

    expect(page.view).toEqual({
      kind: "redirect",
      to: "/gifts/g-open?listToken=tok-1",
    });
  });
});

describe("buildWishMetadata", () => {
  it("называет желание и закрывает страницу от индексации", () => {
    const metadata = buildWishMetadata(
      { locale: "ru", view: { kind: "wish", owner, gift: publicWish } },
      PRODUCT_NAME,
    );

    expect(metadata.title).toBe(`Плед — ${PRODUCT_NAME}`);
    expect(metadata.robots).toEqual({ index: false, follow: false });
    // The wish is not quoted in a link preview: no openGraph on this page.
    expect(metadata.openGraph).toBeUndefined();
  });

  it("даёт закрытый заголовок 404 и не читает название желания", () => {
    const metadata = buildWishMetadata(
      { locale: "ru", view: { kind: "not_found" } },
      PRODUCT_NAME,
    );

    expect(metadata.title).toBe(`Желание не найдено — ${PRODUCT_NAME}`);
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("одинаково закрывает страницу для всех скрытых причин: неизвестный токен, block, сессия", () => {
    const notFound = buildWishMetadata({ locale: "ru", view: { kind: "not_found" } }, PRODUCT_NAME);
    const redirect = buildWishMetadata(
      { locale: "ru", view: { kind: "redirect", to: "/gifts/g-open?listToken=tok-1" } },
      PRODUCT_NAME,
    );

    expect(redirect.title).toBe(notFound.title);
  });
});
