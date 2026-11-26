// @vitest-environment happy-dom
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { CollectionCard } from "./collection-card";
import { createMount, stateValues } from "./test-utils";

const mounted = createMount();

describe("CollectionCard: вариант A", () => {
  it("название и число идей под обложкой, текст не на фото", async () => {
    const { container, render } = mounted();
    await render(<CollectionCard title="На Новый год" count="24 идеи" testID="collection" />);

    const card = container.querySelector<HTMLElement>("[data-testid='collection']") as HTMLElement;
    expect(card.textContent).toBe("На Новый год24 идеи");
    // The cover placeholder is the moon mark: no picture and no text on it.
    expect(card.querySelector("img")).toBeNull();
    expect(card.querySelector("svg")).not.toBeNull();
  });

  it("с onPress вся карточка — кнопка с подписью", async () => {
    const onPress = vi.fn();
    const { container, render } = mounted();
    await render(
      <CollectionCard
        title="На Новый год"
        count="24 идеи"
        onPress={onPress}
        pressLabel="На Новый год, 24 идеи"
        testID="collection"
      />,
    );

    const button = container.querySelector<HTMLElement>("[role='button']") as HTMLElement;
    expect(button.getAttribute("aria-label")).toBe("На Новый год, 24 идеи");
    await act(async () => {
      button.click();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("с обложкой рисует картинку, без onPress карточка не кнопка", async () => {
    const { container, render } = mounted();
    await render(
      <CollectionCard title="Осень" count="18 идей" coverUrl="https://example.test/autumn.jpg" />,
    );

    const image = container.querySelector("img");
    expect(image?.getAttribute("src")).toBe("https://example.test/autumn.jpg");
    expect(image?.getAttribute("alt")).toBe("");
    expect(container.querySelector("[role='button']")).toBeNull();
  });

  /**
   * CLE-129: the whole card is the button, so the cover lifts its shadow on hover
   * and the shadow changes with the `quick` preset, not instantly.
   */
  it("с onPress обложка поднимает тень на hover и меняет её плавно", async () => {
    const { container, render } = mounted();
    await render(<CollectionCard title="Осень" count="18 идей" onPress={vi.fn()} testID="collection" />);

    const cover = container.querySelector<HTMLElement>("[role='button']")?.firstElementChild as HTMLElement;
    expect(stateValues(cover, "base", "box-shadow").join(" ")).not.toBe(
      stateValues(cover, "hover", "box-shadow").join(" "),
    );
    expect(stateValues(cover, "hover", "box-shadow").length).toBeGreaterThan(0);
    expect(cover.style.transition).toContain("160ms");
  });
});
