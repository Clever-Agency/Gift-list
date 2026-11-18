// @vitest-environment happy-dom
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { PartnerStoreCard } from "./partner-store-card";
import { createMount } from "./test-utils";

const mounted = createMount();

describe("PartnerStoreCard: вариант C", () => {
  it("название, категория и промо-чип ниже фото, текст не на фото", async () => {
    const { container, render } = mounted();
    await render(
      <PartnerStoreCard
        name="Северная лавка"
        category="дом и уют"
        promo="−15% по промокоду"
        monogram="СЛ"
        testID="store"
      />,
    );

    const card = container.querySelector<HTMLElement>("[data-testid='store']") as HTMLElement;
    expect(card.textContent).toContain("Северная лавка");
    expect(card.textContent).toContain("дом и уют");
    expect(card.textContent).toContain("−15% по промокоду");
    // The cover placeholder is the monogram on a calm tint: no text over a picture,
    // and the picture itself is absent.
    expect(card.querySelector("img")).toBeNull();
    expect(container.querySelector("[data-testid='store-logo']")?.textContent).toBe("СЛ");
  });

  it("без промо чипа нет", async () => {
    const { container, render } = mounted();
    await render(
      <PartnerStoreCard name="Пиксель" category="техника" promo={null} monogram="ПК" testID="store" />,
    );

    expect(container.textContent).toContain("Пиксель");
    expect(container.textContent).toContain("техника");
    expect(container.textContent).not.toContain("%");
  });

  it("с фото рисует картинку и логотип, без него — заглушки", async () => {
    const { container, render } = mounted();
    await render(
      <PartnerStoreCard
        name="Пиксель"
        category="техника"
        coverUrl="https://example.test/cover.jpg"
        logoUrl="https://example.test/logo.png"
        monogram="ПК"
        testID="store"
      />,
    );

    const images = Array.from(container.querySelectorAll("img"));
    expect(images.map((image) => image.getAttribute("src"))).toEqual([
      "https://example.test/cover.jpg",
      "https://example.test/logo.png",
    ]);
    // The pictures are decorative: the name is written below.
    expect(images.every((image) => image.getAttribute("alt") === "")).toBe(true);
  });

  it("с onPress вся карточка — кнопка с подписью, нажатие работает", async () => {
    const onPress = vi.fn();
    const { container, render } = mounted();
    await render(
      <PartnerStoreCard
        name="Северная лавка"
        category="дом и уют"
        promo="−15% по промокоду"
        monogram="СЛ"
        onPress={onPress}
        pressLabel="Северная лавка, дом и уют, −15% по промокоду"
        testID="store"
      />,
    );

    const button = container.querySelector<HTMLElement>("[role='button']") as HTMLElement;
    expect(button.getAttribute("aria-label")).toBe("Северная лавка, дом и уют, −15% по промокоду");
    await act(async () => {
      button.click();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("без onPress карточка не кнопка", async () => {
    const { container, render } = mounted();
    await render(<PartnerStoreCard name="Пиксель" category="техника" monogram="ПК" />);

    expect(container.querySelector("[role='button']")).toBeNull();
  });
});
