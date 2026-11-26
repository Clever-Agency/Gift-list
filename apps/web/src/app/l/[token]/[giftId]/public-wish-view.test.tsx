import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createGiftListConfig, GiftListProvider } from "@gift-list/ui";
import { AUTHOR_MAILTO, formatPrice, type GiftCard } from "@gift-list/contracts";
import { PublicWishView, type PublicWishData } from "./public-wish-view";

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

const owner = { displayName: "Анна", nick: "anna" };

function view(overrides: Partial<GiftCard> = {}): PublicWishData {
  return {
    owner,
    gift: card({
      id: "g-open",
      title: "Плед",
      description: "Тёплый, цвет — овсяный.",
      priceAmount: 250000,
      priceCurrency: "RUB",
      linkUrl: "https://shop.example/pled",
      tags: [{ catalogId: "home", label: "Дом" }],
      ...overrides,
    }),
  };
}

function render(
  data: PublicWishData,
  listPath: string | null = "/l/tok-1",
  wishlistPath: string | null = "/wishlist/tok-1",
): string {
  return renderToString(
    <GiftListProvider config={config}>
      <PublicWishView
        view={data}
        locale="ru"
        listPath={listPath}
        wishlistPath={wishlistPath}
      />
    </GiftListProvider>,
  );
}

describe("PublicWishView: страница желания по ссылке", () => {
  it("показывает разрешённые поля, владельца и одну «Назад к списку»", () => {
    const html = render(view());

    expect(html.match(/aria-level="1"/g) ?? []).toHaveLength(1);
    expect(html).toContain("Плед");
    expect(html).toContain("Анна");
    expect(html).toContain("@anna");
    expect(html).toContain("Тёплый, цвет — овсяный.");
    expect(html).toContain(formatPrice(250000, "RUB", "ru"));
    expect(html).toContain("https://shop.example/pled");
    expect(html).toContain("Открыт");
    expect(html).toContain("Дом");
    expect(html).toContain('href="/l/tok-1"');
    expect(html).toContain("Назад к списку");
    // The shared public shell, as on /l: one main landmark and the full footer.
    expect(html.match(/<main/g)).toHaveLength(1);
    expect(html).toContain(`href="${AUTHOR_MAILTO}"`);
    expect(html).toContain("Написать автору");
  });

  it("ведёт «Куплю сам» в приложение с возвратом к списку, только для единичного открытого", () => {
    const html = render(view());

    expect(html).toContain(
      'href="/wishlist/tok-1?reserve=g-open&amp;title=%D0%9F%D0%BB%D0%B5%D0%B4"',
    );
    expect(html).toContain('aria-label="Куплю сам: Плед"');
  });

  it("не даёт «Куплю сам» подаренному, забронированному и безграничному желанию", () => {
    for (const overrides of [
      { status: "RESERVED" as const },
      { status: "CLOSED" as const },
      { quantity: "UNLIMITED" as const },
    ]) {
      const html = render(view(overrides));

      expect(html).not.toContain("Куплю сам");
    }
  });

  it("делает имя держателя ссылкой на профиль", () => {
    const html = render(
      view({
        status: "RESERVED",
        reservedBy: { id: "u2", nick: "oleg", displayName: "Олег" },
        reservationLabel: "BOUGHT",
      }),
    );

    expect(html).toContain("Берёт");
    expect(html).toContain('href="/u/oleg"');
    expect(html).toContain("Олег");
    expect(html).toContain("Забронирован");
    // The name link is not nested in the «Куплю сам» link of another wish.
    expect(html.indexOf('href="/u/oleg"')).toBeGreaterThan(html.indexOf("Берёт"));
  });

  it("не показывает полей сверх разрешённого ссылкой: ни видимости, ни архива, ни срока", () => {
    const html = render(
      view({
        visibility: "SECRET",
        archivedAt: "2026-11-01T00:00:00.000Z",
        expiresOn: "2026-12-31",
      }),
    );

    expect(html).not.toContain("Секрет");
    expect(html).not.toContain("Кто видит");
    expect(html).not.toContain("Видимость");
    expect(html).not.toContain("В архиве");
    expect(html).not.toContain("Актуально до");
    expect(html).not.toContain("Сколько раз можно дарить");
    expect(html).not.toContain("31.12.2026");
  });

  it("не рисует ссылку назад и кнопку брони на кривом сегменте", () => {
    const html = render(view(), null, null);

    expect(html).not.toContain("Назад к списку");
    expect(html).not.toContain("Куплю сам");
    expect(html).not.toContain('href="/l/');
  });
});
