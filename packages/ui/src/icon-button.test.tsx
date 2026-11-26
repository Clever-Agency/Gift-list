// @vitest-environment happy-dom
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { IconButton } from "./icon-button";
import { Star } from "./icons";
import { createMount, declarationsFor, stateValues } from "./test-utils";

const mounted = createMount();

function noop() {}

function button(container: HTMLElement): HTMLElement {
  const node = container.querySelector<HTMLElement>("[aria-label='Поделиться']");
  expect(node, "кнопка-иконка").not.toBeNull();
  return node as HTMLElement;
}

function visual(container: HTMLElement): HTMLElement {
  const node = container.querySelector<HTMLElement>("[data-testid='button-icon']");
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

  /**
   * CLE-129: the icon box is the drawn control (`outline` fills `$muted` on hover);
   * the change rides the `quick` preset, and a disabled button keeps the resting
   * look with no transition.
   */
  it("иконка: hover и переход 160 мс у живой, у disabled — без перехода", async () => {
    const { container, render } = mounted();
    await render(<IconButton label="Поделиться" icon={<Star size={20} />} onPress={noop} />);

    const box = visual(container);
    expect(stateValues(box, "hover", "background-color")).toEqual(["var(--muted)"]);
    expect(box.style.transition).toContain("160ms");

    await render(<IconButton label="Поделиться" icon={<Star size={20} />} onPress={noop} disabled />);
    const off = visual(container);
    // The box is out of the pointer's way: the resting look of a blocked control
    // holds (the frame is dimmed to 40% and has no hover of its own).
    expect(stateValues(off, "base", "pointer-events")).toContain("none");
    expect(off.style.transition).toBe("");
  });
});
