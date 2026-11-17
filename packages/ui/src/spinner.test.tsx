// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";

/**
 * `@tamagui/web` captures `window.matchMedia` when it is first imported, so the
 * mock is installed before the imports below (the same controllable mock as in
 * `use-reduce.test.tsx`). It stands in for `prefers-reduced-motion`; the real OS
 * setting is not exercised here.
 */
const windowMedia = vi.hoisted(() => {
  let reduce = false;
  const listeners = new Set<() => void>();

  function matches(query: string): boolean {
    const found = /\(\s*prefers-reduced-motion\s*:\s*(reduce|no-preference)\s*\)/i.exec(query);
    if (!found) return false;
    return (found[1] as string).toLowerCase() === "reduce" ? reduce : !reduce;
  }

  function matchMedia(query: string) {
    return {
      media: query,
      get matches() {
        return matches(query);
      },
      addListener(listener: () => void) {
        listeners.add(listener);
      },
      removeListener(listener: () => void) {
        listeners.delete(listener);
      },
      addEventListener(_: string, listener: () => void) {
        listeners.add(listener);
      },
      removeEventListener(_: string, listener: () => void) {
        listeners.delete(listener);
      },
      dispatchEvent() {
        return false;
      },
      onchange: null,
    };
  }

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: matchMedia,
  });

  return {
    setReduceMotion(value: boolean) {
      reduce = value;
      for (const listener of [...listeners]) listener();
    },
  };
});

import { SPINNER_PERIOD_MS, SPINNER_SIZE } from "./spinner-motion";
import { Spinner } from "./spinner";
import { createMount, nativeOnlyAttributes } from "./test-utils";

const mounted = createMount();

/**
 * The `animateTransform` of the drawing. happy-dom may normalise the case of an
 * SVG tag name, so the element is looked up by its lower-cased name.
 */
function animationOf(spinner: Element): Element | undefined {
  return Array.from(spinner.querySelectorAll("*")).find(function isAnimation(element) {
    return element.tagName.toLowerCase() === "animatetransform";
  });
}

describe("Spinner", () => {
  it("16 px, дуга Lucide, цвет currentColor и displayName", async () => {
    windowMedia.setReduceMotion(false);
    const { container, render } = mounted();
    await render(<Spinner />);

    expect(SPINNER_SIZE).toBe(16);
    const spinner = container.querySelector('[data-testid="spinner"]') as SVGSVGElement;
    expect(spinner.tagName.toLowerCase()).toBe("svg");
    expect(spinner.getAttribute("width")).toBe("16");
    expect(spinner.getAttribute("height")).toBe("16");
    expect(spinner.getAttribute("viewBox")).toBe("0 0 24 24");
    // The arcs follow the text colour of the caller (web `currentColor`).
    expect(spinner.getAttribute("stroke")).toBe("currentColor");
    // CSS keyword values are case-insensitive and happy-dom lower-cases them.
    expect(spinner.style.color.toLowerCase()).toBe("currentcolor");
    expect(spinner.querySelector("path")?.getAttribute("d")).toBe("M21 12a9 9 0 1 1-6.219-8.56");
    expect(Spinner.displayName).toBe("Spinner");
  });

  it("цвет варианта кнопки передаётся значением, разметка остаётся на currentColor", async () => {
    windowMedia.setReduceMotion(false);
    const { container, render } = mounted();
    await render(<Spinner color="#F7FAF7" />);

    const spinner = container.querySelector('[data-testid="spinner"]') as SVGSVGElement;
    expect(spinner.style.color).toBe("#F7FAF7");
    expect(spinner.getAttribute("stroke")).toBe("currentColor");
  });

  it("декоративный: aria-hidden на вебе, ни одного native-пропса в DOM", async () => {
    windowMedia.setReduceMotion(false);
    const { container, render } = mounted();
    await render(<Spinner />);

    const spinner = container.querySelector('[data-testid="spinner"]') as SVGSVGElement;
    expect(spinner.getAttribute("aria-hidden")).toBe("true");
    expect(spinner.getAttribute("focusable")).toBe("false");
    expect(nativeOnlyAttributes(container)).toEqual([]);
  });

  it("без reduce дуга вращается: 0 → 360° за 800 мс, линейно и бесконечно", async () => {
    windowMedia.setReduceMotion(false);
    const { container, render } = mounted();
    await render(<Spinner />);

    const spinner = container.querySelector('[data-testid="spinner"]') as SVGSVGElement;
    const animation = animationOf(spinner) as Element;
    expect(animation).toBeDefined();
    expect(animation.getAttribute("attributeName")).toBe("transform");
    expect(animation.getAttribute("type")).toBe("rotate");
    expect(animation.getAttribute("from")).toBe("0 12 12");
    expect(animation.getAttribute("to")).toBe("360 12 12");
    expect(animation.getAttribute("dur")).toBe(`${SPINNER_PERIOD_MS}ms`);
    expect(animation.getAttribute("calcMode")).toBe("linear");
    expect(animation.getAttribute("repeatCount")).toBe("indefinite");
  });

  it("при reduce анимации нет: дуга статична, ожидание объявляет сам вызывающий", async () => {
    windowMedia.setReduceMotion(true);
    const { container, render } = mounted();
    await render(<Spinner />);

    const spinner = container.querySelector('[data-testid="spinner"]') as SVGSVGElement;
    expect(spinner).not.toBeNull();
    expect(animationOf(spinner)).toBeUndefined();
    windowMedia.setReduceMotion(false);
  });
});
