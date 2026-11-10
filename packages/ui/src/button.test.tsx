// @vitest-environment happy-dom
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./button";
import {
  allDeclarations,
  createMount,
  declarationsFor,
  errorMessages,
  nativeOnlyAttributes,
  stateValues,
} from "./test-utils";

const mounted = createMount();

/** The value `background-color` takes on `element` and the value it takes on hover. */
function background(element: Element): { base?: string; hover?: string } {
  return {
    base: declarationsFor(element, "background-color", false)[0]?.value,
    hover: declarationsFor(element, "background-color", true)[0]?.value,
  };
}

/** The colour a `--c-…` custom property of the token block resolves to, e.g. `#2B5635`. */
function tokenValue(property: string): string | undefined {
  return allDeclarations().find(
    (declaration) => declaration.selector.startsWith(":root") && declaration.property === property,
  )?.value;
}

describe("Button", () => {
  it("на вебе это настоящий <button> с подписью как именем", async () => {
    const { container, render } = mounted();
    await render(<Button label="Сохранить" onPress={vi.fn()} />);

    const button = container.querySelector("button");
    expect(button).not.toBeNull();
    expect(button?.getAttribute("aria-label")).toBe("Сохранить");
    expect(button?.textContent).toBe("Сохранить");
    expect(button?.getAttribute("type")).toBe("button");
  });

  it("нажатие вызывает onPress", async () => {
    const onPress = vi.fn();
    const { container, render } = mounted();
    await render(<Button label="Сохранить" onPress={onPress} />);

    await act(async () => {
      container.querySelector("button")?.click();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("disabled не нажимается и сообщается как отключённая", async () => {
    const onPress = vi.fn();
    const { container, render } = mounted();
    await render(<Button label="Сохранить" onPress={onPress} disabled />);

    const button = container.querySelector("button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    await act(async () => {
      button.click();
    });
    expect(onPress).not.toHaveBeenCalled();
  });

  it("focusableWhenDisabled оставляет кнопку в порядке фокуса, но без нажатия", async () => {
    const onPress = vi.fn();
    const { container, render } = mounted();
    await render(
      <Button label="Отмена" variant="ghost" onPress={onPress} disabled focusableWhenDisabled />,
    );

    const button = container.querySelector("button") as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.tabIndex).toBe(0);
    await act(async () => {
      button.click();
    });
    expect(onPress).not.toHaveBeenCalled();
  });

  it("busy: не берёт второе нажатие и сообщается занятой", async () => {
    const onPress = vi.fn();
    const { container, render } = mounted();
    await render(<Button label="Сохраняем…" onPress={onPress} busy />);

    const button = container.querySelector("button") as HTMLButtonElement;
    expect(button.getAttribute("aria-busy")).toBe("true");
    await act(async () => {
      button.click();
    });
    expect(onPress).not.toHaveBeenCalled();
  });

  it("у каждого варианта есть кнопка с подписью", async () => {
    const { container, render } = mounted();
    for (const variant of ["primary", "reserve", "secondary", "ghost", "destructive"] as const) {
      await render(<Button label={variant} variant={variant} onPress={vi.fn()} />);
      expect(container.querySelector("button")?.textContent).toBe(variant);
    }
  });

  it("busy остаётся фокусируемой: фокус не уходит на body, нажатие и submit игнорируются", async () => {
    const onPress = vi.fn();
    const onSubmit = vi.fn((event: Event) => event.preventDefault());
    const { container, render } = mounted();
    await render(
      <form onSubmit={onSubmit as never}>
        <Button label="Сохранить" type="submit" onPress={onPress} />
      </form>,
    );
    const button = container.querySelector("button") as HTMLButtonElement;
    button.focus();
    expect(document.activeElement).toBe(button);

    await render(
      <form onSubmit={onSubmit as never}>
        <Button label="Сохранить" type="submit" onPress={onPress} busy />
      </form>,
    );
    const busy = container.querySelector("button") as HTMLButtonElement;
    expect(busy.disabled).toBe(false);
    expect(busy.getAttribute("aria-disabled")).toBe("true");
    expect(busy.getAttribute("aria-busy")).toBe("true");
    expect(busy.tabIndex).toBe(0);
    expect(document.activeElement).toBe(busy);

    await act(async () => {
      busy.click();
    });
    expect(onPress).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  /**
   * `DESIGN.md` → Colors, «Hover-затемнение кнопок» (DECISION 2026-11-10): the hover
   * background is the token of the variant darkened by 8%, and the contrast pairs
   * (text on hover) are the approved ones — 8.04 / 5.65 / 7.40:1.
   */
  const HOVER_VARIANTS = [
    { variant: "primary", token: "primary", hex: "#2B5635" },
    { variant: "reserve", token: "accent", hex: "#C39315" },
    { variant: "destructive", token: "destructive", hex: "#A62016" },
  ] as const;

  for (const { variant, token, hex } of HOVER_VARIANTS) {
    it(`${variant}: фон на hover — ${token}-hover, базовый фон прежний`, async function hoverTest() {
      const { container, render } = mounted();
      await render(<Button label="Кнопка" variant={variant} onPress={vi.fn()} />);
      const button = container.querySelector("button") as HTMLElement;

      // Only the hover state changes: the resting background keeps its token.
      expect(background(button)).toEqual({
        base: `var(--c-${token})`,
        hover: `var(--c-${token}-hover)`,
      });
      // The hover rule is a media-query state, so a touch screen never paints it.
      expect(declarationsFor(button).filter((one) => one.selector.includes(":hover") && !one.hover)).toEqual(
        [],
      );
      // The token itself resolves to the approved value of DESIGN.md.
      expect(tokenValue(`--c-${token}-hover`)).toBe(hex);
      expect(tokenValue(`--c-${token}`)).toBe(
        { primary: "#2F5D3A", accent: "#D4A017", destructive: "#B42318" }[token],
      );
    });
  }

  it("secondary темнит границу, ghost — фон; фон secondary на hover не меняется", async () => {
    const { container, render } = mounted();

    await render(<Button label="Отмена" variant="secondary" onPress={vi.fn()} />);
    const secondary = container.querySelector("button") as HTMLElement;
    expect(background(secondary).base).toBe("var(--c-surface)");
    expect(background(secondary).hover).toBeUndefined();
    expect(declarationsFor(secondary, "border-color", true).map((one) => one.value)).toEqual([
      "var(--c-foreground)",
    ]);

    await render(<Button label="Поделиться" variant="ghost" onPress={vi.fn()} />);
    const ghost = container.querySelector("button") as HTMLElement;
    expect(background(ghost)).toEqual({ base: "transparent", hover: "var(--c-muted)" });
  });

  /**
   * Every variant, the property that reacts to the pointer, and the value the state
   * paints on a live button. `DESIGN.md` → Состояния: hover and press are states of a
   * button you can use; a `disabled` / `busy` one keeps its resting look.
   *
   * happy-dom paints nothing, so the check reads the CSS Tamagui generated into
   * `document.styleSheets`: a blocked button's classes must not carry a single
   * declaration under `:where(:hover)` or `:where(:active)`. A real cursor and the
   * media query `(hover: hover)` are not exercised here.
   */
  const POINTER_VARIANTS = [
    { variant: "primary", property: "background-color", base: "var(--c-primary)", hover: "var(--c-primary-hover)" },
    { variant: "reserve", property: "background-color", base: "var(--c-accent)", hover: "var(--c-accent-hover)" },
    {
      variant: "destructive",
      property: "background-color",
      base: "var(--c-destructive)",
      hover: "var(--c-destructive-hover)",
    },
    {
      variant: "secondary",
      property: "border-color",
      base: "var(--c-border-strong)",
      hover: "var(--c-foreground)",
    },
    { variant: "ghost", property: "background-color", base: "transparent", hover: "var(--c-muted)" },
  ] as const;

  for (const { variant, property, base, hover } of POINTER_VARIANTS) {
    it(`${variant}: disabled и busy не меняют вид на hover и press`, async function blockedStates() {
      const { container, render } = mounted();
      await render(<Button label="Кнопка" variant={variant} onPress={vi.fn()} />);
      const live = container.querySelector("button") as HTMLElement;
      // The live button keeps the W12.5 behaviour: the state comes from the CSS.
      expect(stateValues(live, "hover", property)).toEqual([hover]);
      expect(stateValues(live, "base", property)).toEqual([base]);

      await render(<Button label="Кнопка" variant={variant} onPress={vi.fn()} disabled />);
      const off = container.querySelector("button") as HTMLElement;
      expect(stateValues(off, "base", property)).toEqual([base]);
      expect(stateValues(off, "hover", "background-color")).toEqual([]);
      expect(stateValues(off, "hover", "border-color")).toEqual([]);
      expect(stateValues(off, "press", "background-color")).toEqual([]);
      expect(stateValues(off, "press", "opacity")).toEqual([]);
      // The dim of `inactive` is the resting value, not overridden by a state.
      expect(stateValues(off, "base", "opacity")).toEqual(["0.4"]);

      await render(<Button label="Кнопка" variant={variant} onPress={vi.fn()} busy />);
      const running = container.querySelector("button") as HTMLElement;
      expect(stateValues(running, "base", property)).toEqual([base]);
      expect(stateValues(running, "hover", "background-color")).toEqual([]);
      expect(stateValues(running, "hover", "border-color")).toEqual([]);
      expect(stateValues(running, "press", "background-color")).toEqual([]);
      expect(stateValues(running, "press", "opacity")).toEqual([]);
      expect(stateValues(running, "base", "opacity")).toEqual(["0.6"]);
    });
  }

  it("живая кнопка реагирует на press: 0.9 у заливок, фон muted у ghost", async () => {
    const { container, render } = mounted();
    await render(<Button label="Кнопка" variant="primary" onPress={vi.fn()} />);
    expect(stateValues(container.querySelector("button") as HTMLElement, "press", "opacity")).toEqual(["0.9"]);

    await render(<Button label="Поделиться" variant="ghost" onPress={vi.fn()} />);
    expect(
      stateValues(container.querySelector("button") as HTMLElement, "press", "background-color"),
    ).toEqual(["var(--c-muted)"]);
  });

  it("disabled с focusableWhenDisabled тоже не реагирует на hover, но остаётся в Tab-порядке", async () => {
    const { container, render } = mounted();
    await render(<Button label="Кнопка" variant="primary" onPress={vi.fn()} disabled focusableWhenDisabled />);
    const button = container.querySelector("button") as HTMLButtonElement;

    expect(button.disabled).toBe(false);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.tabIndex).toBe(0);
    expect(stateValues(button, "hover", "background-color")).toEqual([]);
    expect(stateValues(button, "press", "opacity")).toEqual([]);
    expect(stateValues(button, "base", "background-color")).toEqual(["var(--c-primary)"]);
  });

  it("каждый вариант: обычная кнопка нажимается, disabled и busy — нет", async () => {
    const { container, render } = mounted();
    for (const { variant } of POINTER_VARIANTS) {
      const onPress = vi.fn();
      await render(<Button label="Кнопка" variant={variant} onPress={onPress} />);
      await act(async () => {
        (container.querySelector("button") as HTMLButtonElement).click();
      });
      expect(onPress, `${variant}: живая`).toHaveBeenCalledTimes(1);

      const offPress = vi.fn();
      await render(<Button label="Кнопка" variant={variant} onPress={offPress} disabled />);
      await act(async () => {
        (container.querySelector("button") as HTMLButtonElement).click();
      });
      expect(offPress, `${variant}: disabled`).not.toHaveBeenCalled();

      const busyPress = vi.fn();
      await render(<Button label="Кнопка" variant={variant} onPress={busyPress} busy />);
      await act(async () => {
        (container.querySelector("button") as HTMLButtonElement).click();
      });
      expect(busyPress, `${variant}: busy`).not.toHaveBeenCalled();
    }
  });

  /**
   * W12.8, `DESIGN.md` → busy: «рядом с текстом — индикатор ожидания». The
   * spinner is a separate component (`spinner.tsx`); `Button` puts it into the
   * button's own row, right before the label (W12.8-fix). happy-dom paints no
   * layout, so what is checked is the structure and the CSS the button carries.
   */
  it("busy: спиннер — сосед подписи в ряду кнопки, перед ней; в обычной и disabled его нет", async () => {
    const { container, render } = mounted();

    await render(<Button label="Сохранить" onPress={vi.fn()} />);
    expect(container.querySelector('[data-testid="spinner"]')).toBeNull();
    expect((container.querySelector("button") as HTMLElement).childElementCount).toBe(1);

    await render(<Button label="Сохранить" onPress={vi.fn()} disabled />);
    expect(container.querySelector('[data-testid="spinner"]')).toBeNull();

    await render(<Button label="Сохранить" onPress={vi.fn()} busy />);
    const button = container.querySelector("button") as HTMLElement;
    const spinner = container.querySelector('[data-testid="spinner"]') as SVGSVGElement;

    // The spinner is a flex item of the button itself, directly before the label.
    expect(spinner.parentElement).toBe(button);
    expect(button.firstElementChild).toBe(spinner);
    expect(spinner.nextElementSibling?.textContent).toBe("Сохранить");
    // The row and its centring are the frame's own: the group sits in the middle.
    expect(stateValues(button, "base", "flex-direction")).toContain("row");
    expect(stateValues(button, "base", "align-items")).toContain("center");
    expect(stateValues(button, "base", "justify-content")).toContain("center");
    // Nothing is taken out of the flow: no absolute slot on the frame or the spinner.
    expect(stateValues(button, "base", "position")).not.toContain("absolute");
    expect(stateValues(spinner, "base", "position")).not.toContain("absolute");
    expect(button.getAttribute("aria-busy")).toBe("true");
  });

  it("busy: у каждого варианта есть спиннер, у disabled-варианта нет", async () => {
    const { container, render } = mounted();
    for (const { variant } of POINTER_VARIANTS) {
      await render(<Button label="Кнопка" variant={variant} onPress={vi.fn()} disabled />);
      expect(container.querySelector('[data-testid="spinner"]'), `${variant}: disabled`).toBeNull();

      await render(<Button label="Кнопка" variant={variant} onPress={vi.fn()} busy />);
      expect(container.querySelector('[data-testid="spinner"]'), `${variant}: busy`).not.toBeNull();
    }
  });

  /** A CSS length from a token custom property of the emitted `:root`, in px. */
  function tokenPx(property: string): number {
    return Number.parseFloat(tokenValue(property) ?? "");
  }

  /**
   * The width must not jump between the resting and the busy button. The spinner
   * and its gap take `16 + 8` px of the label's room, so both horizontal paddings
   * give 12 px back (`card-padding` 16 → 4, W12.8-fix): a content-sized button
   * keeps its resting width, a stretched one takes the parent's width. happy-dom
   * paints no layout; the numbers are read from the tokens the browser gets.
   */
  for (const label of ["ОК", "Сохранить изменения в вишлисте"]) {
    it(`busy: ширина не зависит от спиннера — подпись «${label}»`, async function spinnerWidth() {
      const { container, render } = mounted();

      await render(<Button label={label} onPress={vi.fn()} />);
      const rest = container.querySelector("button") as HTMLElement;
      const restPadding = stateValues(rest, "base", "padding-inline");
      // Nothing is reserved for the spinner: the resting frame is the label alone.
      expect(rest.childElementCount).toBe(1);
      expect(restPadding).toEqual(["var(--t-space-card-padding)"]);

      await render(<Button label={label} onPress={vi.fn()} busy />);
      const busy = container.querySelector("button") as HTMLElement;
      const spinner = container.querySelector('[data-testid="spinner"]') as SVGSVGElement;

      // The paddings shrink by the room the spinner and the gap take.
      expect(stateValues(busy, "base", "padding-inline")).toEqual(["var(--t-space-1)"]);
      expect(stateValues(busy, "base", "gap")).toEqual(["var(--t-space-2)"]);
      // The label keeps its DOM place: it is the next node after the spinner.
      expect(spinner.nextElementSibling?.textContent).toBe(label);

      const resting = tokenPx("--t-space-card-padding");
      const shrunk = tokenPx("--t-space-1");
      const gap = tokenPx("--t-space-2");
      const size = Number(spinner.getAttribute("width"));
      // The real token values, not copies of them.
      expect([resting, shrunk, gap, size]).toEqual([16, 4, 8, 16]);
      // The invariant: what the spinner takes, the two paddings give back.
      expect(size + gap).toBe(2 * (resting - shrunk));
    });
  }

  it("busy + fullWidth: ширину задаёт родитель, выравнивание и паддинги меняются как у всех", async () => {
    const { container, render } = mounted();

    await render(<Button label="Сохранить" onPress={vi.fn()} fullWidth />);
    const rest = container.querySelector("button") as HTMLElement;
    expect(stateValues(rest, "base", "align-self")).toEqual(["stretch"]);

    await render(<Button label="Сохранить" onPress={vi.fn()} fullWidth busy />);
    const busy = container.querySelector("button") as HTMLElement;
    expect(stateValues(busy, "base", "align-self")).toEqual(["stretch"]);
    expect(stateValues(busy, "base", "padding-inline")).toEqual(["var(--t-space-1)"]);
    expect(stateValues(busy, "base", "min-height")).toEqual(
      stateValues(rest, "base", "min-height"),
    );
  });

  it("busy: ghost держит minWidth 44 px, ряд не ломается", async () => {
    const { container, render } = mounted();
    await render(<Button label="Поделиться" variant="ghost" onPress={vi.fn()} busy />);

    const button = container.querySelector("button") as HTMLElement;
    // `minWidth` / `minHeight` are size tokens (`--t-size-…`), not space tokens.
    expect(stateValues(button, "base", "min-width")).toContain("var(--t-size-touch-target)");
    expect(stateValues(button, "base", "min-height")).toContain("var(--t-size-touch-target)");
    expect(stateValues(button, "base", "padding-inline")).toEqual(["var(--t-space-1)"]);
    expect(container.querySelector('[data-testid="spinner"]')?.nextElementSibling?.textContent).toBe(
      "Поделиться",
    );
  });

  it("busy: экранный диктор не видит спиннер и не получает native-пропсов", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(function noop() {});
    try {
      const { container, render } = mounted();
      await render(<Button label="Сохранить" onPress={vi.fn()} busy />);

      const spinner = container.querySelector('[data-testid="spinner"]') as SVGSVGElement;
      expect(spinner.getAttribute("aria-hidden")).toBe("true");
      expect(nativeOnlyAttributes(container)).toEqual([]);
      expect(errorMessages(errors)).not.toContain("does not recognize");
    } finally {
      errors.mockRestore();
    }
  });

  it("подпись не меняет цвет: текст остаётся foreground-токеном своего варианта", async () => {
    const { container, render } = mounted();
    const expected = {
      primary: "var(--c-primary-foreground)",
      reserve: "var(--c-accent-foreground)",
      destructive: "var(--c-destructive-foreground)",
    } as const;

    for (const [variant, color] of Object.entries(expected)) {
      await render(
        <Button label="Кнопка" variant={variant as keyof typeof expected} onPress={vi.fn()} />,
      );
      const label = Array.from((container.querySelector("button") as HTMLElement).querySelectorAll("*"))
        .flatMap(function declarations(element) {
          return declarationsFor(element, "color", false);
        })
        .map(function value(one) {
          return one.value;
        });
      expect(label, variant).toContain(color);
    }
  });
});
