// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Toast } from "./toast";
import { createMount, settle, stateValues } from "./test-utils";

const mounted = createMount();

/** «Уменьшить движение»: настоящий `prefers-reduced-motion` happy-dom не считает. */
const media = vi.hoisted(() => ({ reduce: false }));
vi.mock("./use-reduce", () => ({ useReduceMotion: () => media.reduce }));

function noop() {}

function root(): HTMLElement {
  const found = document.querySelector<HTMLElement>("[data-testid='toast']");
  if (!found) throw new Error("Тост не найден");
  return found;
}

/** Атомарный класс непрозрачности Tamagui: `_o-…`. */
function opacityClass(node: HTMLElement): string {
  return node.className
    .split(/\s+/)
    .filter((name) => name.startsWith("_o-"))
    .join(" ");
}

beforeEach(() => {
  media.reduce = false;
});

describe("Toast", () => {
  it("появляется с fade quick 160 мс", async () => {
    const { render } = mounted();
    await render(<Toast testID="toast" message="Сохранено" closeLabel="Закрыть" onClose={noop} />);

    // Первый кадр — enter-класс Tamagui: тост проявляется, а не появляется сразу.
    expect(root().className).toContain("t_unmounted");

    await settle();
    expect(root().style.transition).toContain("160ms");
    expect(root().className).not.toContain("t_unmounted");
  });

  it("уходит fade: уход — смена непрозрачности при той же длительности", async () => {
    const { render } = mounted();
    await render(<Toast testID="toast" message="Сохранено" closeLabel="Закрыть" onClose={noop} />);
    await settle();
    const shown = opacityClass(root());

    await render(
      <Toast testID="toast" message="Сохранено" closeLabel="Закрыть" onClose={noop} visible={false} />,
    );
    expect(opacityClass(root())).not.toBe(shown);
    expect(root().style.transition).toContain("160ms");
  });

  it("при reduce появление и уход — fade до 100 мс, без сдвига", async () => {
    media.reduce = true;
    const { render } = mounted();
    await render(<Toast testID="toast" message="Сохранено" closeLabel="Закрыть" onClose={noop} />);
    await settle();

    expect(root().style.transition).toContain("100ms");
    expect(root().style.transform).toBe("");
    expect(root().style.transition).not.toContain("translate");
  });

  it("кольцо кнопки — $ring-inverse и только на :focus-visible", async () => {
    const { render } = mounted();
    await render(<Toast testID="toast" message="Сохранено" closeLabel="Закрыть" onClose={noop} />);

    const close = document.querySelector('[aria-label="Закрыть"]') as HTMLElement;
    const keyboard = stateValues(close, "focus-visible", "outline-color");
    expect(keyboard).toContain("var(--c-ring-inverse)");
    expect(keyboard).not.toContain("var(--c-ring)");
    expect(stateValues(close, "focus", "outline-color")).toEqual([]);
  });
});
