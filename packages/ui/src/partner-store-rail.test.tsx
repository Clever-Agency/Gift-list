// @vitest-environment happy-dom
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { PartnerStoreCard } from "./partner-store-card";
import { PartnerStoreRail } from "./partner-store-rail";
import { createMount, declarationsFor } from "./test-utils";

const mounted = createMount();

function noop() {}

const stores = (
  <>
    <PartnerStoreCard name="Северная лавка" category="дом и уют" monogram="СЛ" />
    <PartnerStoreCard name="Пиксель" category="техника" monogram="ПК" />
  </>
);

function byLabel(container: HTMLElement, label: string): HTMLElement {
  const node = container.querySelector<HTMLElement>(`[aria-label='${label}']`);
  expect(node, label).not.toBeNull();
  return node as HTMLElement;
}

describe("PartnerStoreRail", () => {
  it("заголовок, метка «Партнёры» с пояснением и карточки в одной ленте", async () => {
    const { container, render } = mounted();
    await render(
      <PartnerStoreRail
        title="Магазины-партнёры"
        label="Партнёры"
        labelInfo="WishMoon получает вознаграждение за покупки по этим ссылкам"
        allLabel="Все"
        onAllPress={noop}
        testID="rail"
      >
        {stores}
      </PartnerStoreRail>,
    );

    expect(container.textContent).toContain("Магазины-партнёры");
    expect(container.textContent).toContain("Партнёры");
    expect(container.textContent).toContain("Все");
    // The slider is the only horizontal list of the design.
    const list = container.querySelector<HTMLElement>("[role='list']") as HTMLElement;
    expect(list).not.toBeNull();
    expect(list.children).toHaveLength(2);
    expect(declarationsFor(list, "flex-direction").map((one) => one.value)).toContain("row");
  });

  it("«Все» и пояснение метки — кнопки со своими подписями", async () => {
    const onAll = vi.fn();
    const onLabel = vi.fn();
    const { container, render } = mounted();
    await render(
      <PartnerStoreRail
        title="Магазины-партнёры"
        label="Партнёры"
        labelInfo="Реклама: магазины платят за покупки"
        onLabelPress={onLabel}
        allLabel="Все"
        onAllPress={onAll}
      >
        {stores}
      </PartnerStoreRail>,
    );

    await act(async () => {
      byLabel(container, "Все").click();
    });
    expect(onAll).toHaveBeenCalledTimes(1);

    await act(async () => {
      byLabel(container, "Реклама: магазины платят за покупки").click();
    });
    expect(onLabel).toHaveBeenCalledTimes(1);
  });

  it("без метки и «Все» заголовок остаётся один, метка не статична", async () => {
    const { container, render } = mounted();
    await render(
      <PartnerStoreRail title="Магазины-партнёры">
        {stores}
      </PartnerStoreRail>,
    );

    expect(container.querySelectorAll("[role='button']")).toHaveLength(0);
  });
});
