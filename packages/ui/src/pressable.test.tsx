// @vitest-environment happy-dom
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { Pressable } from "./pressable";
import { createMount, nativeOnlyAttributes, stateValues } from "./test-utils";

const mounted = createMount();

async function key(node: Element, init: KeyboardEventInit) {
  await act(async () => {
    node.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));
  });
}

describe("Pressable: клавиатура", () => {
  it("Enter и пробел нажимают кнопку, зажатая клавиша не повторяет нажатие", async () => {
    const onPress = vi.fn();
    const { container, render } = mounted();
    await render(<Pressable role="button" aria-label="Ещё" onPress={onPress} />);
    const node = container.querySelector("[role='button']") as HTMLElement;

    await key(node, { key: "Enter" });
    await key(node, { key: " " });
    expect(onPress).toHaveBeenCalledTimes(2);

    await key(node, { key: "Enter", repeat: true });
    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it("ссылка нажимается только Enter, пробел её не активирует", async () => {
    const onPress = vi.fn();
    const { container, render } = mounted();
    await render(<Pressable role="link" aria-label="Автор" onPress={onPress} />);
    const node = container.querySelector("[role='link']") as HTMLElement;

    await key(node, { key: " " });
    expect(onPress).not.toHaveBeenCalled();
    await key(node, { key: "Enter" });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("onKeyDown из пропсов не затирается и вызывается до нажатия", async () => {
    const order: string[] = [];
    const { container, render } = mounted();
    await render(
      <Pressable
        role="button"
        aria-label="Ещё"
        onPress={() => order.push("press")}
        onKeyDown={() => order.push("keydown")}
      />,
    );
    await key(container.querySelector("[role='button']") as HTMLElement, { key: "Enter" });
    expect(order).toEqual(["keydown", "press"]);
  });
});

/**
 * W12.10: the web keeps `role="button"` in the DOM while the phone default moved
 * to `accessibilityRole`. A native-only prop must not appear in the DOM: React
 * would warn about an unknown attribute and no browser would read it (W12.1).
 */
describe("Pressable: роль на вебе", () => {
  it("по умолчанию это div role=button без accessibilityRole в DOM", async () => {
    const { container, render } = mounted();
    await render(<Pressable aria-label="Ещё" onPress={vi.fn()} />);
    const node = container.querySelector("[role='button']") as HTMLElement;

    expect(node.tagName).toBe("DIV");
    expect(node.getAttribute("role")).toBe("button");
    expect(node.hasAttribute("accessibilityrole")).toBe(false);
    expect(node.hasAttribute("accessibilityRole")).toBe(false);
    expect(nativeOnlyAttributes(container)).toEqual([]);
  });

  it("роль вызывающего заменяет дефолт", async () => {
    const { container, render } = mounted();
    await render(<Pressable role="radio" aria-checked aria-label="Друзьям" onPress={vi.fn()} />);

    expect(container.querySelector("[role='radio']")).not.toBeNull();
    expect(container.querySelector("[role='button']")).toBeNull();
    expect(nativeOnlyAttributes(container)).toEqual([]);
  });
});

/**
 * `DESIGN.md` → Состояния кнопок и нажимаемых поверхностей: press is a state of a
 * surface you can use; a disabled one keeps its resting 40% dim (DECISION 2026-11-10).
 *
 * happy-dom paints nothing, so the check reads the CSS Tamagui generated into
 * `document.styleSheets`: a disabled surface's classes must not carry a single
 * `opacity` declaration under `:where(:active)`. A real cursor is not exercised here.
 */
describe("Pressable: press и disabled", () => {
  it("живая поверхность тускнеет на press до 0.9, disabled — нет", async () => {
    const { container, render } = mounted();
    await render(<Pressable role="button" aria-label="Ещё" onPress={vi.fn()} />);
    const live = container.querySelector("[role='button']") as HTMLElement;
    expect(stateValues(live, "press", "opacity")).toEqual(["0.9"]);

    await render(<Pressable role="button" aria-label="Ещё" onPress={vi.fn()} disabled />);
    const off = container.querySelector("[role='button']") as HTMLElement;
    // The dim of `inactive` is the resting value, not overridden by a state.
    expect(stateValues(off, "base", "opacity")).toEqual(["0.4"]);
    expect(stateValues(off, "press", "opacity")).toEqual([]);
    expect(stateValues(off, "press", "cursor")).toEqual([]);
    expect(getComputedStyle(off).opacity).toBe("0.4");
  });

  it("disabled остаётся в Tab-порядке и объявленным, но клик, Enter и пробел не нажимают", async () => {
    const onPress = vi.fn();
    const { container, render } = mounted();
    await render(<Pressable role="button" aria-label="Ещё" onPress={onPress} disabled />);
    const node = container.querySelector("[role='button']") as HTMLElement;

    expect(node.getAttribute("aria-disabled")).toBe("true");
    expect(node.tabIndex).toBe(0);
    node.focus();
    expect(document.activeElement).toBe(node);

    await act(async () => {
      node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await key(node, { key: "Enter" });
    await key(node, { key: " " });
    expect(onPress).not.toHaveBeenCalled();
  });
});
