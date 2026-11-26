import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createGiftListConfig, GiftListProvider } from "@gift-list/ui";
import { AUTHOR_MAILTO, type GiftCard } from "@gift-list/contracts";
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

function render(
  view: PublicWishlistData,
  listPath: string | null = "/l/tok-1",
  wishlistPath: string | null = "/wishlist/tok-1",
) {
  return renderToString(
    <GiftListProvider config={config}>
      <PublicWishlistView
        view={view}
        locale="ru"
        listPath={listPath}
        wishlistPath={wishlistPath}
      />
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
    expect(html).toContain(`href="${AUTHOR_MAILTO}"`);
    expect(html).toContain("Написать автору");
    expect(html).toContain('role="contentinfo"');
    expect(html).toContain("Плед");
    expect(html).toContain("мечта");
    expect(html).toContain("Открыт");
    // The shared shell: the skip link first, the one main landmark with its id.
    expect(html.indexOf('href="#main-content"')).toBeLessThan(html.indexOf("<main"));
    expect(html).toContain('href="#main-content"');
    expect(html.match(/<main/g)).toHaveLength(1);
    expect(html).toContain('id="main-content"');
    expect(html).toContain('tabindex="-1"');
    // No visibility chip and no hidden count on the public page.
    expect(html).not.toContain("Видимость");
    expect(html).not.toContain("Секрет");
    // Tamagui CSS is part of this server render, not a client-only shell.
    expect(html).toContain("<style");
    expect(html).toContain("--primary");
  });

  it("делает имя дарителя ссылкой на его профиль и не вкладывает её в кнопку", () => {
    const html = render({
      kind: "gifts",
      owner,
      gifts: [
        card({
          id: "g-reserved",
          title: "Свитер",
          status: "RESERVED",
          reservedBy: { id: "u2", nick: "oleg", displayName: "Олег" },
          reservationLabel: "BOUGHT",
        }),
      ],
    });

    expect(html).toContain("Берёт");
    expect(html).toContain('href="/u/oleg"');
    expect(html).toContain("Олег");
    // The name link is a sibling of the card link, never its content: the card
    // anchor closes before the profile link starts.
    const cardStart = html.indexOf('href="/l/tok-1/g-reserved"');
    const cardEnd = html.indexOf("</a>", cardStart);
    expect(cardStart).toBeGreaterThan(-1);
    expect(cardEnd).toBeGreaterThan(cardStart);
    expect(html.slice(cardStart, cardEnd)).not.toContain('href="/u/oleg"');
    expect(html.indexOf('href="/u/oleg"')).toBeGreaterThan(cardEnd);
  });

  it("карточка — ссылка на страницу одного желания, а не на диалог", () => {
    const html = render({
      kind: "gifts",
      owner,
      gifts: [
        card({ id: "g-open", title: "Плед" }),
        card({ id: "g-two", title: "Свитер" }),
      ],
    });

    expect(html).toContain('href="/l/tok-1/g-open"');
    expect(html).toContain('href="/l/tok-1/g-two"');
    expect(html).toContain('aria-label="Плед"');
    // T4.5 / D-63: no detail dialog button stays on the link page.
    expect(html).not.toContain('role="button"');
    expect(html).not.toContain("public-wish-detail");
  });

  it("не показывает имени дарителя, когда сервер его не прислал", () => {
    const html = render({
      kind: "gifts",
      owner,
      gifts: [card({ id: "g-reserved", title: "Свитер", status: "RESERVED" })],
    });

    expect(html).not.toContain("Берёт");
    expect(html).not.toContain('href="/u/');
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

    expect(html).toContain(
      'href="/wishlist/tok-1?reserve=g-open&amp;title=%D0%9F%D0%BB%D0%B5%D0%B4"',
    );
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
    expect(html).not.toContain("не найден");
    // The footer is the same full one in the empty state.
    expect(html).toContain(`href="${AUTHOR_MAILTO}"`);
    expect(html).toContain("Написать автору");
  });
});
