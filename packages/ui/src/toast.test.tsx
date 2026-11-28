// @vitest-environment happy-dom
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Toast } from "./toast";
import { createMount, nativeOnlyAttributes, settle, stateValues } from "./test-utils";

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

  it("кольцо кнопки — $ring и только на :focus-visible", async () => {
    const { render } = mounted();
    await render(<Toast testID="toast" message="Сохранено" closeLabel="Закрыть" onClose={noop} />);

    const close = document.querySelector('[aria-label="Закрыть"]') as HTMLElement;
    const keyboard = stateValues(close, "focus-visible", "outline-color");
    // v8: the toast is a surface card in both themes, so the regular ring shows on it.
    expect(keyboard).toContain("var(--ring)");
    expect(keyboard).not.toContain("var(--ring-inverse)");
    expect(stateValues(close, "focus", "outline-color")).toEqual([]);
  });
});

describe("Toast: тоны", () => {
  const TONES = [
    { tone: "info", role: "status", live: "polite", ink: "#2B3A7A" },
    { tone: "success", role: "status", live: "polite", ink: "#2C7352" },
    { tone: "warning", role: "alert", live: "assertive", ink: "#7E4A42" },
    { tone: "error", role: "alert", live: "assertive", ink: "#C4473D" },
  ] as const;

  for (const { tone, role, live, ink } of TONES) {
    it(`${tone}: роль ${role}, ${live}, иконка ${ink}`, async () => {
      const { container, render } = mounted();
      await render(
        <Toast testID="toast" tone={tone} message="Сообщение" closeLabel="Закрыть" onClose={noop} />,
      );

      const card = container.querySelector<HTMLElement>(`[role='${role}']`);
      expect(card).not.toBeNull();
      expect(card?.getAttribute("aria-live")).toBe(live);
      expect(container.querySelector("[role='alert']") !== null).toBe(role === "alert");

      const icon = container.querySelector<SVGElement>("[data-testid='toast-icon']");
      expect(icon).not.toBeNull();
      // One icon per tone, coloured by its calm ink; the text stays neutral.
      expect(icon?.getAttribute("stroke")).toBe(ink);
      expect(icon?.getAttribute("aria-hidden")).toBe("true");
      expect(container.querySelector("[data-testid='spinner']")).toBeNull();
    });
  }

  it("иконки у тонов разные: галочка, треугольник и круг с восклицанием", async () => {
    const { container, render } = mounted();
    const shapes: Record<string, string> = {};

    for (const tone of ["success", "warning", "error"] as const) {
      await render(
        <Toast testID="toast" tone={tone} message="Сообщение" closeLabel="Закрыть" onClose={noop} />,
      );
      const icon = container.querySelector<SVGElement>("[data-testid='toast-icon']");
      shapes[tone] = icon?.innerHTML ?? "";
    }

    expect(shapes.success).not.toBe(shapes.warning);
    expect(shapes.warning).not.toBe(shapes.error);
    expect(shapes.success).not.toBe(shapes.error);
  });
});

describe("Toast: платформы", () => {
  it("на вебе нет React Native пропов: объявляет live-регион карточки", async () => {
    const { container, render } = mounted();
    await render(
      <Toast testID="toast" tone="error" message="Нет сети" closeLabel="Закрыть" onClose={noop} />,
    );

    const card = container.querySelector<HTMLElement>("[role='alert']");
    expect(card?.getAttribute("aria-live")).toBe("assertive");
    // `accessibilityLiveRegion` and the announcement are phone-only: the web
    // module must not paint stray `accessibility…` attributes in the DOM.
    expect(nativeOnlyAttributes(container)).toEqual([]);
  });
});

describe("Toast: варианты", () => {
  it("заголовок и описание: две строки, заголовок первым", async () => {
    const { container, render } = mounted();
    await render(
      <Toast
        testID="toast"
        tone="success"
        title="Желание забронировано"
        message="Владелец не узнает, кто его выбрал."
        closeLabel="Закрыть"
        onClose={noop}
      />,
    );

    const text = container.textContent ?? "";
    expect(text).toContain("Желание забронировано");
    expect(text).toContain("Владелец не узнает, кто его выбрал.");
    expect(text.indexOf("Желание забронировано")).toBeLessThan(text.indexOf("Владелец не узнает"));
  });

  it("loading: спиннер вместо иконки и aria-busy на карточке", async () => {
    const { container, render } = mounted();
    await render(
      <Toast testID="toast" tone="info" message="Сохраняем" loading closeLabel="Закрыть" onClose={noop} />,
    );

    expect(container.querySelector("[data-testid='spinner']")).not.toBeNull();
    expect(container.querySelector("[data-testid='toast-icon']")).toBeNull();
    expect(container.querySelector("[role='status']")?.getAttribute("aria-busy")).toBe("true");
  });

  it("dismissible=false убирает крестик, по умолчанию он есть", async () => {
    const { container, render } = mounted();
    await render(<Toast testID="toast" message="Сохранено" closeLabel="Закрыть" onClose={noop} />);
    expect(container.querySelector("[aria-label='Закрыть']")).not.toBeNull();

    await render(
      <Toast testID="toast" message="Сохранено" closeLabel="Закрыть" dismissible={false} onClose={noop} />,
    );
    expect(container.querySelector("[aria-label='Закрыть']")).toBeNull();
    expect(container.textContent).toContain("Сохранено");
  });

  it("действие — текстовая кнопка со своим именем, длинный текст остаётся целиком", async () => {
    const onAction = vi.fn();
    const long = "Очень длинное сообщение тоста, которое должно переноситься на несколько строк и не обрезать кнопки";
    const { container, render } = mounted();
    await render(
      <Toast
        testID="toast"
        tone="error"
        message={long}
        action={{ label: "Повторить", onPress: onAction }}
        closeLabel="Закрыть"
        onClose={noop}
      />,
    );

    expect(container.textContent).toContain(long);
    const action = container.querySelector<HTMLElement>("[aria-label='Повторить']");
    expect(action).not.toBeNull();
    action?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("крестик — иконка с подписью из closeLabel", async () => {
    const { container, render } = mounted();
    await render(<Toast testID="toast" message="Сохранено" closeLabel="Закрыть" onClose={noop} />);

    const close = container.querySelector<HTMLElement>("[aria-label='Закрыть']");
    expect(close).not.toBeNull();
    expect(close?.getAttribute("role")).toBe("button");
    // The cross is a picture: the name comes from the label, not from the glyph.
    expect(close?.querySelector("svg")).not.toBeNull();
    expect((close?.textContent ?? "").trim()).toBe("");
  });
});

describe("Toast: фокус сообщает, какой элемент его получил", () => {
  it("действие и крестик приходят со своей подписью action / close", async () => {
    const onFocusChange = vi.fn();
    const { container, render } = mounted();
    await render(
      <Toast
        testID="toast"
        tone="info"
        message="Отмечено полученным"
        action={{ label: "Отменить", onPress: noop }}
        closeLabel="Закрыть"
        onClose={noop}
        onFocusChange={onFocusChange}
      />,
    );

    const action = container.querySelector<HTMLElement>("[aria-label='Отменить']");
    const close = container.querySelector<HTMLElement>("[aria-label='Закрыть']");

    // Экран переводит фокус на действие сам — хост должен узнать, что это действие,
    // а не крестик: программный фокус отсчёт не держит.
    act(() => {
      action?.focus();
    });
    expect(onFocusChange).toHaveBeenLastCalledWith(true, "action");

    act(() => {
      close?.focus();
    });
    expect(onFocusChange.mock.calls).toContainEqual([false, "action"]);
    expect(onFocusChange).toHaveBeenLastCalledWith(true, "close");

    act(() => {
      close?.blur();
    });
    expect(onFocusChange).toHaveBeenLastCalledWith(false, "close");
  });
});

describe("Toast: ссылка на кнопку действия", () => {
  it("actionRef указывает на кнопку действия и переводит на неё фокус", async () => {
    const actionRef = { current: null as object | null };
    const { render } = mounted();
    await render(
      <Toast
        testID="toast"
        tone="success"
        message="Отмечено полученным"
        action={{ label: "Отменить", onPress: noop }}
        actionRef={actionRef}
        closeLabel="Закрыть"
        onClose={noop}
      />,
    );

    const action = document.querySelector<HTMLElement>("[aria-label='Отменить']");
    expect(actionRef.current).toBe(action);
    // The screen moves focus there itself: the ref is a focusable control.
    act(() => {
      (actionRef.current as HTMLElement).focus();
    });
    expect(document.activeElement).toBe(action);
  });

  it("без действия ссылка остаётся пустой", async () => {
    const actionRef = { current: null as object | null };
    const { render } = mounted();
    await render(
      <Toast testID="toast" message="Сохранено" actionRef={actionRef} closeLabel="Закрыть" onClose={noop} />,
    );

    expect(actionRef.current).toBeNull();
  });
});
