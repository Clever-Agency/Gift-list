import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGiftListConfig, GiftListProvider } from "@gift-list/ui";
import type { GiftCard } from "@gift-list/contracts";

const { notFound, redirect, getWishPage, buildWishMetadata, getBrandName } = vi.hoisted(() => ({
  notFound: vi.fn(),
  redirect: vi.fn(),
  getWishPage: vi.fn(),
  buildWishMetadata: vi.fn(),
  getBrandName: vi.fn(() => "WishMoon"),
}));

vi.mock("next/navigation", () => ({ notFound, redirect }));
vi.mock("@/lib/env", () => ({ getBrandName }));
vi.mock("./wish-page", () => ({ getWishPage, buildWishMetadata }));

import PublicWishPage, { generateMetadata } from "./page";

const config = createGiftListConfig({
  body: "var(--font-sans)",
  heading: "var(--font-heading)",
});

const params = Promise.resolve({ token: "tok-1", giftId: "g-open" });
const searchParams = Promise.resolve({});

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

const wishPage = {
  locale: "ru" as const,
  listPath: "/l/tok-1",
  wishlistPath: "/wishlist/tok-1",
  view: {
    kind: "wish" as const,
    owner: { displayName: "Анна", nick: "anna" },
    gift: card({ id: "g-open", title: "Плед" }),
  },
};

beforeEach(() => {
  notFound.mockReset();
  redirect.mockReset();
  getWishPage.mockReset();
  buildWishMetadata.mockReset();
  // Next's real `notFound()` throws and stops the segment; the tests do the same.
  notFound.mockImplementation(() => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  });
});

describe("app/l/[token]/[giftId]/page.tsx", () => {
  it("renders the wish, the way back and the server shell in the first HTML", async () => {
    getWishPage.mockResolvedValue(wishPage);

    const element = await PublicWishPage({ params, searchParams });
    const html = renderToString(<GiftListProvider config={config}>{element}</GiftListProvider>);

    expect(getWishPage).toHaveBeenCalledWith("tok-1", "g-open");
    expect(html).toContain("Плед");
    expect(html).toContain('href="/l/tok-1"');
    expect(html).toContain("Перейти к содержимому");
    expect(html.match(/aria-level="1"/g) ?? []).toHaveLength(1);
    expect(html.indexOf('href="#main-content"')).toBeLessThan(html.indexOf("<main"));
    expect(html.match(/<main/g)).toHaveLength(1);
    expect(html).toContain('id="main-content"');
    expect(html).toContain('tabindex="-1"');
    expect(notFound).not.toHaveBeenCalled();
  });

  it("calls notFound() for a foreign or closed wish instead of a 200 page", async () => {
    getWishPage.mockResolvedValue({ ...wishPage, view: { kind: "not_found" } });

    await expect(PublicWishPage({ params, searchParams })).rejects.toThrow(
      "NEXT_HTTP_ERROR_FALLBACK;404",
    );
    expect(notFound).toHaveBeenCalledTimes(1);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("hands a session to the app wish page before any public view is rendered", async () => {
    getWishPage.mockResolvedValue({
      ...wishPage,
      view: { kind: "redirect", to: "/gifts/g-open?listToken=tok-1" },
    });

    await PublicWishPage({ params, searchParams });

    expect(redirect).toHaveBeenCalledWith("/gifts/g-open?listToken=tok-1");
    expect(notFound).not.toHaveBeenCalled();
  });

  it("builds the page metadata from the same one-wish load", async () => {
    getWishPage.mockResolvedValue(wishPage);
    buildWishMetadata.mockReturnValue({ title: "Плед — WishMoon" });

    const metadata = await generateMetadata({ params, searchParams });

    expect(buildWishMetadata).toHaveBeenCalledWith(wishPage, "WishMoon");
    expect(metadata.title).toBe("Плед — WishMoon");
  });
});
