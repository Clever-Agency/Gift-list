// @vitest-environment happy-dom
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { IconButton } from "./icon-button";
import { Star } from "./icons";
import { createMount, declarationsFor } from "./test-utils";

const mounted = createMount();

function noop() {}

function button(container: HTMLElement): HTMLElement {
  const node = container.querySelector<HTMLElement>("[aria-label='Поделиться']");
  expect(node, "кнопка-иконка").not.toBeNull();
  return node as HTMLElement;
}

function visual(container: HTMLElement): HTMLElement {
  const node = container.querySelector<HTMLElement>("[data-testid='icon-button-visual']");
  expect(node, "визуал кнопки").not.toBeNull();
  return node as HTMLElement;
}

describe("IconButton: иконка без текста", () => {
  it("зона 44 × 44, визуал 44 с радиусом 8 и подпись для диктора", async () => {
    const { container, render } = mounted();
    await render(<IconButton label="Поделиться" icon={<Star size={20} />} onPress={noop} />);

    const target = button(container);
    expect(target.getAttribute("role")).toBe("button");
    expect(declarationsFor(target, "min-width").map((one) => one.value)).toContain(
      "var(--t-size-touch-target)",
    );
    expect(declarationsFor(target, "min-height").map((one) => one.value)).toContain(
      "var(--t-size-touch-target)",
    );
    expect(declarationsFor(visual(container), "width").map((one) => one.value)).toContain("44px");
    expect(declarationsFor(visual(container), "border-radius").map((one) => one.value)).toContain(
      "var(--t-radius-md)",
    );
  });

  it("нажатие вызывает обработчик, disabled — не вызывает и объявлен", async () => {
    const onPress = vi.fn();
    const { container, render } = mounted();
    await render(<IconButton label="Поделиться" icon={<Star size={20} />} onPress={onPress} />);

    await act(async () => {
      button(container).click();
    });
    expect(onPress).toHaveBeenCalledTimes(1);

    await render(
      <IconButton label="Поделиться" icon={<Star size={20} />} onPress={onPress} disabled />,
    );
    await act(async () => {
      button(container).click();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(button(container).getAttribute("aria-disabled")).toBe("true");
  });

  it("вариант plain снимает рамку, но оставляет зону 44 × 44", async () => {
    const { container, render } = mounted();
    await render(<IconButton label="Поделиться" icon={<Star size={20} />} variant="plain" />);

    expect(declarationsFor(visual(container), "border-color").map((one) => one.value)).toContain(
      "transparent",
    );
    expect(declarationsFor(button(container), "min-width").map((one) => one.value)).toContain(
      "var(--t-size-touch-target)",
    );
  });

  it("size=sm: круг 32 px внутри зоны 44, primary — заливка primary", async () => {
    const { container, render } = mounted();
    await render(
      <IconButton label="Поделиться" icon={<Star size={16} />} size="sm" shape="round" variant="primary" />,
    );

    const target = button(container);
    expect(declarationsFor(target, "min-width").map((one) => one.value)).toContain(
      "var(--t-size-touch-target)",
    );
    expect(declarationsFor(visual(container), "width").map((one) => one.value)).toContain("32px");
    expect(declarationsFor(visual(container), "height").map((one) => one.value)).toContain("32px");
    expect(declarationsFor(visual(container), "border-radius").map((one) => one.value)).toContain(
      "var(--t-radius-full)",
    );
    expect(declarationsFor(visual(container), "background-color").map((one) => one.value)).toContain(
      "var(--primary)",
    );
    expect(declarationsFor(visual(container), "color").map((one) => one.value)).toContain(
      "var(--primary-foreground)",
    );
  });
});
