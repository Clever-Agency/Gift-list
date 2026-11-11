// @vitest-environment happy-dom
import { breakpoints, spacing } from "@gift-list/ui";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { declarationsFor, findByPaint, paintedSpace, paintedValue } from "@/test/tamagui-css";
import { pageGutter } from "@/ui/card-grid";
import { SessionErrorScreen } from "@/ui/session-error-screen";

/**
 * W12.14 (same per-screen migration as W12.12/W12.13): the page no longer reads
 * the window width in JS. The gutter is the Tamagui media clause
 * `$page-gutter medium:$page-gutter-lg` for both column sizes, so the browser
 * turns it into a CSS media query and the phone uses the same key. The widths are
 * checked against the CSS Tamagui actually generated (see `@/test/tamagui-css`),
 * not against a browser layout.
 */

/** The counter proves the screen never asks React Native for the window width. */
const dimensions = vi.hoisted(() => ({ calls: 0 }));

vi.mock("react-native", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-native")>();
  function useWindowDimensions() {
    dimensions.calls += 1;
    return actual.useWindowDimensions();
  }
  return { ...actual, useWindowDimensions };
});

vi.mock("use-intl", async () => {
  const { readFileSync } = await import("node:fs");
  const { dirname, join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const root = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
  const common = JSON.parse(
    readFileSync(join(root, "packages/contracts/src/i18n/ru/common.json"), "utf8"),
  ) as Record<string, unknown>;

  function lookup(catalog: unknown, key: string): string {
    let node = catalog;
    for (const part of key.split(".")) {
      if (typeof node !== "object" || node == null || !(part in node)) return key;
      node = (node as Record<string, unknown>)[part];
    }
    return typeof node === "string" ? node : key;
  }

  return {
    useTranslations: (namespace: string) => (key: string) =>
      lookup(namespace === "common" ? common : {}, key),
  };
});

vi.mock("react-native-safe-area-context", async () => {
  const React = await import("react");
  return {
    SafeAreaView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement("div", null, children),
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLElement;

async function mount(element: ReactNode) {
  await act(async () => {
    root.render(element);
  });
}

/** Mounts the screen at one column size; the retry spy is for the caller to assert. */
async function mountError(size?: "form" | "wide") {
  const retry = vi.fn();
  await mount(<SessionErrorScreen size={size} onRetry={retry} />);
  return retry;
}

beforeEach(() => {
  dimensions.calls = 0;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("SessionErrorScreen", () => {
  it("одна прокрутка страницы, alert-регион и кнопка «Повторить»", async () => {
    const retry = vi.fn();
    await mount(<SessionErrorScreen onRetry={retry} />);

    const page = container.querySelector<HTMLElement>('[data-testid="session-error-page"]');
    expect(page).not.toBeNull();
    expect(getComputedStyle(page as Element).overflowY).toBe("auto");

    const region = container.querySelector<HTMLElement>('[data-testid="session-error"]');
    expect(region?.getAttribute("role")).toBe("alert");
    expect(region?.getAttribute("aria-live")).toBe("assertive");
    expect(region?.textContent).toContain("Нет связи с сервером");
    expect(region?.textContent).toContain("Проверьте сеть");

    const footer = container.querySelector<HTMLElement>('[data-testid="page-footer"]');
    expect(footer).not.toBeNull();
    expect(footer?.getAttribute("role")).toBe("contentinfo");
    expect(footer?.textContent).toContain("Сделано с любовью командой cleverAgency");

    const scrollers = Array.from(container.querySelectorAll("*")).filter((node) =>
      ["auto", "scroll"].includes(getComputedStyle(node).overflowY),
    );
    expect(scrollers).toEqual([page]);
  });

  it("«Повторить» вызывает переданный обработчик", async () => {
    const retry = vi.fn();
    await mount(<SessionErrorScreen onRetry={retry} />);

    const button = Array.from(container.querySelectorAll("button")).find((node) =>
      (node.textContent ?? "").includes("Повторить"),
    );
    expect(button).toBeDefined();
    await act(async () => button?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("форма: тот же стабильный testID", async () => {
    await mount(<SessionErrorScreen size="form" onRetry={vi.fn()} />);
    expect(container.querySelector('[data-testid="session-error"]')).not.toBeNull();
  });
});

/** The one `GLColumn` of the page: the column whose padding is the page gutter. */
function column(): HTMLElement {
  const node = container.querySelector<HTMLElement>('[name="GLColumn"]');
  expect(node, "колонка страницы").not.toBeNull();
  return node as HTMLElement;
}

describe("W12.14: SessionErrorScreen на медиа-пропсах", () => {
  it("ширина окна из JS не читается", async () => {
    await mountError();

    expect(dimensions.calls).toBe(0);
  });

  it("счётчик видит экран, который ширину читает (контроль)", async () => {
    // A probe through the same import the screen used to call: a zero above means
    // the mock is in place, not that the spy is broken.
    const { useWindowDimensions } = await import("react-native");
    function Probe() {
      useWindowDimensions();
      return null;
    }
    await act(async () => root.render(<Probe />));

    expect(dimensions.calls).toBeGreaterThan(0);
  });

  describe.each(["form", "wide"] as const)("size=%s", (size) => {
    it.each([360, 600, 1024, 1280])("ширина %ipx: отступ как у pageGutter", async (width) => {
      await mountError(size);

      expect(paintedSpace(column(), "padding-inline", width)).toBe(pageGutter(width));
    });

    it("граница одна и та же: 16 до bp-medium, 24 от bp-medium", async () => {
      await mountError(size);
      const element = column();

      expect(paintedSpace(element, "padding-inline", 360)).toBe(spacing["page-gutter"]);
      expect(paintedSpace(element, "padding-inline", breakpoints.medium - 1)).toBe(
        spacing["page-gutter"],
      );
      expect(paintedSpace(element, "padding-inline", breakpoints.medium)).toBe(
        spacing["page-gutter-lg"],
      );
      expect(paintedSpace(element, "padding-inline", 1280)).toBe(spacing["page-gutter-lg"]);
    });

    it("меняется только на одной медиа-точке, без лишних правил", async () => {
      await mountError(size);
      const gutterRules = declarationsFor(column(), "padding-inline");

      expect(gutterRules).toHaveLength(2);
      const conditions = gutterRules.map((rule) => rule.minWidth);
      expect(conditions).toContain(null);
      expect(conditions).toContain(breakpoints.medium);
    });

    it("отступы и gap — токены $section-gap/$grid-gap с прежними px", async () => {
      await mountError(size);
      const body = findByPaint(container, "padding-block", "section-gap");
      const region = body as Element;

      expect(body, "контент экрана ошибки").toBeDefined();
      expect(paintedValue(region, "padding-block", 360)).toBe("var(--t-space-section-gap)");
      expect(paintedSpace(region, "padding-block", 360)).toBe(spacing["section-gap"]);
      expect(paintedValue(region, "gap", 360)).toBe("var(--t-space-grid-gap)");
      expect(paintedSpace(region, "gap", 360)).toBe(spacing["grid-gap"]);
    });

    it("alert, заголовок и кнопка на месте", async () => {
      await mountError(size);

      expect(container.querySelector('[data-testid="session-error"]')?.getAttribute("role")).toBe(
        "alert",
      );
      expect(container.querySelector('[role="heading"]')?.textContent).toBe("Нет связи с сервером");
      expect(container.querySelector('[role="heading"]')?.getAttribute("aria-level")).toBe("1");
      expect(container.querySelector("button")?.textContent).toContain("Повторить");
    });
  });
});
