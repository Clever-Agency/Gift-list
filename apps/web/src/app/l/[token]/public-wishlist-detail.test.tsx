// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createGiftListConfig, GiftListProvider } from "@gift-list/ui";
import type { GiftCard } from "@gift-list/contracts";
import { PublicWishlistView, type PublicWishlistData } from "./public-wishlist-view";

const config = createGiftListConfig({
  body: "var(--font-sans)",
  heading: "var(--font-heading)",
});

function card(overrides: Partial<GiftCard> & Pick<GiftCard, "id" | "title">): GiftCard {
  return {
    description: "Тёплый плед, которого нет на карточке.",
    priceAmount: null,
    priceCurrency: null,
    linkUrl: "https://shop.example/pled",
    visibility: "SECRET",
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

const view: PublicWishlistData = {
  kind: "gifts",
  owner: { displayName: "Анна", nick: "anna" },
  gifts: [card({ id: "g-open", title: "Плед" })],
};

let host: Root;
let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  host = createRoot(container);
});

afterEach(async () => {
  await act(async () => host.unmount());
  container.remove();
});

async function mount() {
  await act(async () => {
    host.render(
      <GiftListProvider config={config}>
        <PublicWishlistView view={view} locale="ru" wishlistPath="/wishlist/tok-1" />
      </GiftListProvider>,
    );
  });
}

describe("PublicWishlistView: диалог подробностей", () => {
  it("карточка открывает поля гостя и не показывает видимость", async () => {
    await mount();
    expect(document.body.textContent).not.toContain("Тёплый плед");

    const cardButton = document.querySelector("[aria-label='Плед']") as HTMLElement;
    await act(async () => {
      cardButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const dialog = document.querySelector("[role='dialog']");
    expect(dialog?.textContent).toContain("Тёплый плед, которого нет на карточке.");
    expect(dialog?.textContent).toContain("https://shop.example/pled");
    expect(dialog?.textContent).not.toContain("Секрет");
    expect(dialog?.textContent).not.toContain("Кто видит");

    const close = document.querySelector("[aria-label='Закрыть']") as HTMLElement;
    await act(async () => {
      close.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      await new Promise(function waitForFade(resolve) {
        setTimeout(resolve, 300);
      });
    });
    expect(document.querySelector("[role='dialog']")).toBeNull();
    expect(document.activeElement).toBe(cardButton);
  });

  it("«Куплю сам» не открывает диалог", async () => {
    await mount();
    const buy = document.querySelector("a[href^='/wishlist/tok-1?reserve=']") as HTMLElement;
    await act(async () => {
      buy.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(document.querySelector("[role='dialog']")).toBeNull();
    expect(document.body.textContent).not.toContain("Тёплый плед, которого нет на карточке.");
  });
});
