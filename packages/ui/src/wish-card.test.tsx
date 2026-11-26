// @vitest-environment happy-dom
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { StatusPill } from "./status-pill";
import { TagChipList } from "./tag-chip";
import { createMount, declarationsFor, stateValues } from "./test-utils";
import { VisibilityChip } from "./visibility-chip";
import { WishCard } from "./wish-card";

const mounted = createMount();

function plusHidden(hidden: number): string {
  return `+${hidden}`;
}


describe("WishCard", () => {
  it("карточка — элемент списка с названием, ценой, статусом и бронью", async () => {
    const { container, render } = mounted();
    await render(
      <WishCard
        title="Плед"
        price="2 500 ₽"
        status={<StatusPill status="reserved" label="Забронировано" />}
        reservation="Забронировал Аня"
      />,
    );

    const card = container.querySelector("[role='listitem']") as HTMLElement;
    expect(card).not.toBeNull();
    expect(card.textContent).toContain("Плед");
    expect(card.textContent).toContain("2 500 ₽");
    expect(card.textContent).toContain("Забронировано");
    expect(card.textContent).toContain("Забронировал Аня");
    expect(card.querySelector("[role='button']")).toBeNull();
  });

  it("listItem={false}: роли listitem у карточки нет — её несёт обёртка ячейки", async () => {
    const { container, render } = mounted();
    await render(
      <WishCard
        title="Плед"
        status={<StatusPill status="open" label="Открыт" />}
        listItem={false}
      />,
    );

    expect(container.querySelector("[role='listitem']")).toBeNull();
    expect(container.textContent).toContain("Плед");
  });

  it("с onPress вся карточка — кнопка с именем, Enter и Space тоже нажимают", async () => {
    const onPress = vi.fn();
    const { container, render } = mounted();
    await render(
      <WishCard
        title="Плед"
        status={<StatusPill status="open" label="Свободно" />}
        onPress={onPress}
        pressLabel="Плед, 2 500 ₽, Свободно"
      />,
    );

    const button = container.querySelector("[role='button']") as HTMLElement;
    expect(button.getAttribute("aria-label")).toBe("Плед, 2 500 ₽, Свободно");
    await act(async () => {
      button.click();
    });
    await act(async () => {
      button.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      button.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    });
    expect(onPress).toHaveBeenCalledTimes(3);
  });

  it("без pressLabel имя кнопки собирается из содержимого, а не из одного названия", async () => {
    const { container, render } = mounted();
    await render(
      <WishCard
        title="Плед"
        price="2 500 ₽"
        status={<StatusPill status="open" label="Свободно" />}
        onPress={vi.fn()}
      />,
    );

    const button = container.querySelector("[role='button']") as HTMLElement;
    expect(button.getAttribute("aria-label")).toBeNull();
    expect(button.textContent).toContain("Плед");
    expect(button.textContent).toContain("2 500 ₽");
    expect(button.textContent).toContain("Свободно");
  });

  it("чип соседний элемент, а не внутри кнопки карточки; Tab: карточка, затем чип", async () => {
    const onChip = vi.fn();
    const onCard = vi.fn();
    const { container, render } = mounted();
    await render(
      <WishCard
        title="Плед"
        status={<StatusPill status="open" label="Свободно" />}
        onPress={onCard}
        pressLabel="Плед, 2 500 ₽, Свободно"
        chipInteractive
        chip={
          <VisibilityChip
            tone="public"
            label="Всем"
            accessibilityLabel="Видимость: всем. Изменить"
            onPress={onChip}
          />
        }
      />,
    );

    const buttons = Array.from(container.querySelectorAll("[role='button']"));
    expect(buttons.map((node) => node.getAttribute("aria-label"))).toEqual([
      "Плед, 2 500 ₽, Свободно",
      "Видимость: всем. Изменить",
    ]);
    expect(buttons[0]?.contains(buttons[1] as Node)).toBe(false);
    expect(buttons[1]?.getAttribute("aria-haspopup")).toBe("dialog");

    await act(async () => {
      (buttons[1] as HTMLElement).click();
    });
    expect(onChip).toHaveBeenCalledTimes(1);
    expect(onCard).not.toHaveBeenCalled();
  });

  it("чип без onPress не кнопка", async () => {
    const { container, render } = mounted();
    await render(<VisibilityChip tone="secret" label="Секрет" />);

    expect(container.querySelector("[role='button']")).toBeNull();
    expect(container.textContent).toBe("Секрет");
  });

  it("v8: фото-плитка 4:5 с радиусом 16 и тенью карточки, текст под фото", async () => {
    const { container, render } = mounted();
    await render(
      <WishCard
        testID="card"
        title="Плед"
        price="2 500 ₽"
        status={<StatusPill status="open" label="Открыт" />}
      />,
    );

    const photo = container.querySelector<HTMLElement>("[data-testid='card-photo']");
    expect(photo).not.toBeNull();
    expect(declarationsFor(photo as Element, "border-radius").map((one) => one.value)).toContain(
      "var(--t-radius-lg)",
    );
    // The theme carries the v8 elevation as one value (`$shadow-card`): the plate
    // takes it as the `--shadow-card` variable of the active theme.
    const shadow = declarationsFor(photo as Element, "box-shadow").map((one) => one.value).join(" ");
    expect(shadow).toContain("var(--shadow-card)");

    // The placeholder is a picture: the moon is decorative and no text sits on the photo.
    expect(photo?.querySelector("svg")).not.toBeNull();
    expect(photo?.textContent).toBe("");
    // The title is the first text of the card, after the photo plate.
    expect(container.querySelector("[role='listitem']")?.textContent?.startsWith("Плед")).toBe(true);
  });

  it("v8: без onPress тень не поднимается на hover", async () => {
    const { container, render } = mounted();
    await render(<WishCard testID="card" title="Плед" status={<StatusPill status="open" label="Открыт" />} />);

    const photo = container.querySelector<HTMLElement>("[data-testid='card-photo']") as HTMLElement;
    const hoverShadows = declarationsFor(photo, "box-shadow", true);
    expect(hoverShadows).toEqual([]);
  });

  /**
   * CLE-129, T2.2: the hover belongs to the whole card, not only to the photo.
   * The card button is the Tamagui group, so the plate lifts its shadow and the
   * title is underlined when the pointer is anywhere over the card. The general
   * `$muted` fill of `Pressable` is off — the card paints its own hover.
   */
  it("hover на всей карточке: группа кнопки поднимает тень плитки и подчёркивает название", async () => {
    const { container, render } = mounted();
    await render(
      <WishCard
        testID="card"
        title="Плед"
        status={<StatusPill status="open" label="Открыт" />}
        onPress={vi.fn()}
        pressLabel="Плед, Открыт"
      />,
    );

    const button = container.querySelector<HTMLElement>("[role='button']") as HTMLElement;
    expect(button.classList.contains("t_group_true")).toBe(true);
    // No muted fill on the whole card: the plate and the title carry the hover.
    expect(stateValues(button, "hover", "background-color")).toEqual([]);

    const photo = container.querySelector<HTMLElement>("[data-testid='card-photo']") as HTMLElement;
    const hoverShadow = declarationsFor(photo, "box-shadow", true);
    expect(hoverShadow.length).toBeGreaterThan(0);
    // Only a hover of the group paints the shadow — not a hover of the plate itself.
    for (const declaration of hoverShadow) {
      expect(declaration.selector).toContain(".t_group_true");
    }
    expect(hoverShadow.map((declaration) => declaration.value).join(" ")).toContain(
      "var(--shadow-card-hover)",
    );
    // The shadow glides with the shared `quick` preset; the card does not scale.
    expect(photo.style.transition).toContain("160ms");
    expect(stateValues(photo, "hover", "transform")).toEqual([]);

    const title = container.querySelector<HTMLElement>("[data-testid='card-title']") as HTMLElement;
    const hoverDecoration = declarationsFor(title, "text-decoration-line", true);
    expect(hoverDecoration.map((declaration) => declaration.value)).toEqual(["underline"]);
    for (const declaration of hoverDecoration) {
      expect(declaration.selector).toContain(".t_group_true");
    }
  });

  it("v8: без onPress у названия нет hover-подчёркивания", async () => {
    const { container, render } = mounted();
    await render(<WishCard testID="card" title="Плед" status={<StatusPill status="open" label="Открыт" />} />);

    const title = container.querySelector<HTMLElement>("[data-testid='card-title']") as HTMLElement;
    expect(declarationsFor(title, "text-decoration-line", true)).toEqual([]);
  });

  it("StatusPill — подпись словом, не кнопка", async () => {
    const { container, render } = mounted();
    await render(<StatusPill status="closed" label="Закрыто" />);

    expect(container.textContent).toBe("Закрыто");
    expect(container.querySelector("[role='button']")).toBeNull();
  });

  /**
   * `ReservationCard` puts its actions in the `footer` slot: they are a sibling of
   * the card button, so no control is nested inside another and Tab goes card
   * first, actions next.
   */
  it("footer — сосед кнопки карточки, а не её содержимое", async () => {
    const { container, render } = mounted();
    await render(
      <WishCard
        testID="card"
        title="Плед"
        status={<StatusPill status="reserved" label="Забронирован" />}
        onPress={vi.fn()}
        pressLabel="Плед, Забронирован"
        footer={<button type="button">Подарил</button>}
      />,
    );

    const footer = container.querySelector<HTMLElement>("[data-testid='card-footer']");
    const cardButton = container.querySelector<HTMLElement>("[role='button']") as HTMLElement;
    expect(footer).not.toBeNull();
    expect(cardButton.contains(footer as Node)).toBe(false);
    expect(footer?.textContent).toBe("Подарил");
  });

  it("теги идут между статусом и бронью — до трёх и «+N», без лишних кнопок", async () => {    const { container, render } = mounted();
    await render(
      <WishCard
        title="Плед"
        status={<StatusPill status="reserved" label="Забронировано" />}
        tags={<TagChipList labels={["мечта", "нужно сейчас", "когда-нибудь", "своё"]} moreLabel={plusHidden} />}
        reservation="Забронировал Аня"
      />,
    );

    const card = container.querySelector("[role='listitem']") as HTMLElement;
    expect(card.textContent).toBe("ПледЗабронированомечтанужно сейчаскогда-нибудь+1Забронировал Аня");
    expect(card.querySelector("[role='button']")).toBeNull();
    expect(card.querySelector("[role='checkbox']")).toBeNull();
  });

  it("без тегов ряда нет", async () => {
    const { container, render } = mounted();
    await render(
      <WishCard
        title="Плед"
        status={<StatusPill status="open" label="Открыт" />}
        reservation="Забронировал Аня"
      />,
    );

    expect(container.textContent).toBe("ПледОткрытЗабронировал Аня");
  });
});
