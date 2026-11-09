import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createGiftListConfig, GiftListProvider } from "@gift-list/ui";
import type { GiftCard } from "@gift-list/contracts";
import { PublicWishlistView, type PublicWishlistData } from "./public-wishlist-view";

const config = createGiftListConfig({
  body: "var(--font-sans)",
  heading: "var(--font-heading)",
});

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

function render(view: PublicWishlistData, wishlistPath: string | null = "/wishlist/tok-1") {
  return renderToString(
    <GiftListProvider config={config}>
      <PublicWishlistView view={view} locale="ru" wishlistPath={wishlistPath} />
    </GiftListProvider>,
  );
}

const owner = { displayName: "Анна", nick: "anna" };

/** L8: a page has exactly one level-1 heading. */
function levelOneHeadings(html: string): number {
  return html.match(/aria-level="1"/g)?.length ?? 0;
}

describe("PublicWishlistView: link page HTML", () => {
  it("renders the owner as the heading, the nick, PUBLIC cards and their CSS on the server", () => {
    const html = render({
      kind: "gifts",
      owner,
      gifts: [
        card({
          id: "g-open",
          title: "Плед",
          priceAmount: 250000,
          priceCurrency: "RUB",
          tags: [{ catalogId: "t1", label: "мечта" }],
        }),
      ],
    });

    expect(levelOneHeadings(html)).toBe(1);
    expect(html).toContain("Анна");
    expect(html).toContain("@anna");
    expect(html).toContain("Сделано с любовью командой cleverAgency");
    expect(html).toContain('role="contentinfo"');
    expect(html).toContain("Плед");
    expect(html).toContain("мечта");
    expect(html).toContain("Открыт");
    // No visibility chip and no hidden count on the public page.
    expect(html).not.toContain("Видимость");
    expect(html).not.toContain("Секрет");
    // Tamagui CSS is part of this server render, not a client-only shell.
    expect(html).toContain("<style");
    expect(html).toContain("--c-primary:#2F5D3A");
  });

  it("links «Куплю сам» only for a SINGLE and OPEN wish, relative to the SPA", () => {
    const html = render({
      kind: "gifts",
      owner,
      gifts: [
        card({ id: "g-open", title: "Плед", quantity: "SINGLE", status: "OPEN" }),
        card({ id: "g-unlimited", title: "Свитер", quantity: "UNLIMITED", status: "OPEN" }),
        card({ id: "g-reserved", title: "Наушники", quantity: "SINGLE", status: "RESERVED" }),
      ],
    });

    expect(html).toContain('href="/wishlist/tok-1"');
    expect(html).toContain('aria-label="Куплю сам: Плед"');
    expect(html).not.toContain("Куплю сам: Свитер");
    expect(html).not.toContain("Куплю сам: Наушники");
    expect(html).not.toContain('href="http');
    expect(html).not.toContain('href="//');
  });

  it("uses the exact empty phrase, not a closed-list phrase", () => {
    const html = render({ kind: "gifts", owner, gifts: [] });

    expect(html).toContain("Пока нет открытых желаний");
    expect(html).not.toContain("закрыт");
    expect(html).not.toContain("Список не найден");
  });

  it("renders one not-found phrase without an owner or wishes", () => {
    const html = render({ kind: "not_found" }, null);

    expect(levelOneHeadings(html)).toBe(1);
    expect(html).toContain("Список не найден");
    expect(html).toContain("Сделано с любовью командой cleverAgency");
    expect(html).toContain('role="contentinfo"');
    expect(html).not.toContain("Анна");
    expect(html).not.toContain("Плед");
    expect(html).not.toContain("Пока нет открытых желаний");
  });
});
