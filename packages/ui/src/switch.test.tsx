// @vitest-environment happy-dom
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { Switch } from "./switch";
import { createMount } from "./test-utils";

const mounted = createMount();

function noop() {}

function control(container: HTMLElement): HTMLElement {
  const node = container.querySelector('[role="switch"]');
  expect(node, "switch").not.toBeNull();
  return node as HTMLElement;
}

function track(container: HTMLElement): HTMLElement {
  const node = container.querySelector('[data-testid="switch-track"]');
  expect(node, "track").not.toBeNull();
  return node as HTMLElement;
}

function thumb(container: HTMLElement): HTMLElement {
  const node = container.querySelector('[data-testid="switch-thumb"]');
  expect(node, "thumb").not.toBeNull();
  return node as HTMLElement;
}

async function press(node: HTMLElement) {
  await act(async () => {
    node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("Switch: состояние и доступность", () => {
  it("объявляется переключателем с видимой подписью и aria-checked", async () => {
    const { container, render } = mounted();
    await render(<Switch label="Показывать друзьям" checked={false} onChange={noop} />);

    const node = control(container);
    expect(node.getAttribute("aria-checked")).toBe("false");
    expect(node.getAttribute("aria-label")).toBe("Показывать друзьям");
    expect(node.textContent).toContain("Показывать друзьям");
    expect(node.getAttribute("aria-disabled")).toBeNull();
  });

  it("показывает включённое состояние в aria-checked и в цвете трека", async () => {
    const { container, render } = mounted();
    await render(<Switch label="Скрыть из поиска" checked onChange={noop} />);

    expect(control(container).getAttribute("aria-checked")).toBe("true");
    expect(getComputedStyle(track(container)).backgroundColor).toBe("#2F5D3A");
    expect(getComputedStyle(thumb(container)).backgroundColor).toBe("#FFFFFF");
  });

  it("выключенный трек — border-strong", async () => {
    const { container, render } = mounted();
    await render(<Switch label="Скрыть из поиска" checked={false} onChange={noop} />);

    expect(control(container).getAttribute("aria-checked")).toBe("false");
    expect(getComputedStyle(track(container)).backgroundColor).toBe("#8F8673");
  });

  it("размеры трека и бегунка по DESIGN.md: 52×32 и 28", async () => {
    const { container, render } = mounted();
    await render(<Switch label="Скрыть из поиска" checked={false} onChange={noop} />);

    expect(getComputedStyle(track(container)).width).toBe("52px");
    expect(getComputedStyle(track(container)).height).toBe("32px");
    expect(getComputedStyle(thumb(container)).width).toBe("28px");
    expect(getComputedStyle(thumb(container)).height).toBe("28px");
  });
});

describe("Switch: нажатие и клавиатура", () => {
  it("нажатие на всю строку просит следующее состояние", async () => {
    const onChange = vi.fn();
    const { container, render } = mounted();
    await render(<Switch label="Скрыть из поиска" checked={false} onChange={onChange} />);

    await press(control(container));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("выключение просит false", async () => {
    const onChange = vi.fn();
    const { container, render } = mounted();
    await render(<Switch label="Скрыть из поиска" checked onChange={onChange} />);

    await press(control(container));

    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("Space переключает, как в DESIGN.md", async () => {
    const onChange = vi.fn();
    const { container, render } = mounted();
    await render(<Switch label="Скрыть из поиска" checked={false} onChange={onChange} />);

    await act(async () => {
      control(container).dispatchEvent(
        new KeyboardEvent("keydown", { key: " ", bubbles: true }),
      );
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("disabled не меняет значение и объявлен недоступным", async () => {
    const onChange = vi.fn();
    const { container, render } = mounted();
    await render(
      <Switch label="Скрыть из поиска" checked={false} disabled onChange={onChange} />,
    );

    await press(control(container));

    expect(onChange).not.toHaveBeenCalled();
    expect(control(container).getAttribute("aria-disabled")).toBe("true");
  });
});

describe("Switch: подсказка", () => {
  it("hint связан с переключателем через aria-describedby и виден", async () => {
    const { container, render } = mounted();
    await render(
      <Switch
        label="Скрыть из поиска"
        hint="Прямые ссылки по-прежнему работают"
        checked
        onChange={noop}
      />,
    );

    const describedBy = control(container).getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)?.textContent).toBe(
      "Прямые ссылки по-прежнему работают",
    );
  });

  it("без hint ссылки на отсутствующий текст нет", async () => {
    const { container, render } = mounted();
    await render(<Switch label="Скрыть из поиска" checked={false} onChange={noop} />);

    expect(control(container).getAttribute("aria-describedby")).toBeNull();
  });
});
