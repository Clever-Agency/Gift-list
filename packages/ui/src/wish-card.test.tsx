// @vitest-environment happy-dom
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { StatusPill } from "./status-pill";
import { createMount } from "./test-utils";
import { VisibilityChip } from "./visibility-chip";
import { WishCard } from "./wish-card";

const mounted = createMount();


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

  it("с onPress вся карточка — кнопка с именем, Enter и Space тоже нажимают", async () => {
    const onPress = vi.fn();
    const { container, render } = mounted();
    await render(
      <WishCard
        title="Плед"
        status={<StatusPill status="open" label="Свободно" />}
        onPress={onPress}
        pressLabel="Редактировать «Плед»"
      />,
    );

    const button = container.querySelector("[role='button']") as HTMLElement;
    expect(button.getAttribute("aria-label")).toBe("Редактировать «Плед»");
    await act(async () => {
      button.click();
    });
    await act(async () => {
      button.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      button.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    });
    expect(onPress).toHaveBeenCalledTimes(3);
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
        pressLabel="Редактировать «Плед»"
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
      "Редактировать «Плед»",
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

  it("StatusPill — подпись словом, не кнопка", async () => {
    const { container, render } = mounted();
    await render(<StatusPill status="closed" label="Закрыто" />);

    expect(container.textContent).toBe("Закрыто");
    expect(container.querySelector("[role='button']")).toBeNull();
  });
});
