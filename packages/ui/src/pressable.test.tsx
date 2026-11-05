// @vitest-environment happy-dom
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { Pressable } from "./pressable";
import { createMount } from "./test-utils";

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
