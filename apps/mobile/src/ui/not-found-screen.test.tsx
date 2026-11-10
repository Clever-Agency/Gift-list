// @vitest-environment happy-dom
import { breakpoints, spacing } from "@gift-list/ui";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { declarationsFor, paintedSpace, paintedValue } from "@/test/tamagui-css";
import { pageGutter } from "@/ui/card-grid";
import { NotFoundScreen } from "@/ui/not-found-screen";

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

vi.mock("expo-router", async () => {
  const React = await import("react");
  return {
    Stack: { Screen: () => null },
    Link: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});
vi.mock("react-native-safe-area-context", async () => {
  const React = await import("react");
  return {
    SafeAreaView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement("div", null, children),
  };
});
vi.mock("use-intl", async () => {
  const { readFileSync } = await import("node:fs");
  const { dirname, join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const root = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
  function read(name: string): Record<string, unknown> {
    return JSON.parse(
      readFileSync(join(root, `packages/contracts/src/i18n/ru/${name}.json`), "utf8"),
    ) as Record<string, unknown>;
  }
  const catalogs = { app: read("app"), common: read("common") };

  function lookup(catalog: unknown, key: string, values?: Record<string, unknown>): string {
    let node = catalog;
    for (const part of key.split(".")) {
      if (typeof node !== "object" || node == null || !(part in node)) return key;
      node = (node as Record<string, unknown>)[part];
    }
    if (typeof node !== "string") return key;
    return node.replace(/\{(\w+)\}/g, (_, name: string) => String(values?.[name] ?? ""));
  }

  function catalogFor(namespace: string): unknown {
    const [head, ...rest] = namespace.split(".");
    const base = head === "common" ? catalogs.common : catalogs.app;
    return rest.reduce<unknown>(
      (node, part) =>
        typeof node === "object" && node !== null
          ? (node as Record<string, unknown>)[part]
          : undefined,
      base,
    );
  }

  return {
    useTranslations:
      (namespace: string) => (key: string, values?: Record<string, unknown>) =>
        lookup(catalogFor(namespace), key, values),
    useLocale: () => "ru",
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;

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

async function mount() {
  await act(async () => {
    root.render(<NotFoundScreen />);
  });
}

describe("UI6: страница 404", () => {
  it("показывает бренд, заголовок, объяснение и ссылку на главную", async () => {
    await mount();

    expect(container.textContent).toContain("Gift List");
    expect(container.textContent).toContain("Страница не найдена");
    expect(container.textContent).toContain("Такой страницы нет. Проверьте ссылку.");
    expect(container.textContent).toContain("На главную");

    const page = container.querySelector('[data-testid="not-found-page"]');
    expect(page).not.toBeNull();
    expect(page?.getAttribute("role")).toBeNull();
    expect(container.querySelectorAll('[role="heading"]')).toHaveLength(1);
    expect(container.querySelector('[role="link"]')?.textContent).toBe("На главную");

    const footer = container.querySelector<HTMLElement>('[data-testid="page-footer"]');
    expect(footer).not.toBeNull();
    expect(footer?.getAttribute("role")).toBe("contentinfo");
    expect(footer?.textContent).toContain("Сделано с любовью командой cleverAgency");
  });

  it("это страница целиком: один скролл и контент внутри него", async () => {
    await mount();

    const page = container.querySelector('[data-testid="not-found-page"]') as HTMLElement;
    expect(getComputedStyle(page).overflowY).toBe("auto");
    expect(page.textContent).toContain("Страница не найдена");

    const scrollers = Array.from(container.querySelectorAll("*")).filter((node) =>
      ["auto", "scroll"].includes(getComputedStyle(node).overflowY),
    );
    expect(scrollers).toEqual([page]);
  });
});

function column(): HTMLElement {
  const node = container.querySelector<HTMLElement>('[name="GLColumn"]');
  expect(node, "колонка формы").not.toBeNull();
  return node as HTMLElement;
}

/** The one `role="heading"` of the page: the `h1` «Страница не найдена». */
function heading(): HTMLElement {
  const node = container.querySelector<HTMLElement>('[role="heading"]');
  expect(node, "заголовок страницы").not.toBeNull();
  return node as HTMLElement;
}

function textBlock(text: string): HTMLElement | undefined {
  return Array.from(container.querySelectorAll<HTMLElement>("*")).find(
    (node) => node.textContent === text,
  );
}

/**
 * W12.13 (`DESIGN.md` → App → Точки перехода, «Реализация раскладки»): the page
 * no longer reads the window width in JS, and the empty state is centred as a
 * whole (`DESIGN.md:430`). The widths are checked against the CSS Tamagui
 * actually generated (see `@/test/tamagui-css`), not against a browser layout.
 */
describe("W12.13: страница 404 на медиа-пропсах и с заголовком по центру", () => {
  it("ширина окна из JS не читается", async () => {
    await mount();

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

  it.each([360, 600, 1024, 1280])("ширина %ipx: отступ как у pageGutter", async (width) => {
    await mount();

    expect(paintedSpace(column(), "padding-inline", width)).toBe(pageGutter(width));
  });

  it("граница одна и та же: 16 до bp-medium, 24 от bp-medium", async () => {
    await mount();
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
    await mount();
    const gutterRules = declarationsFor(column(), "padding-inline");

    expect(gutterRules).toHaveLength(2);
    const conditions = gutterRules.map((rule) => rule.minWidth);
    expect(conditions).toContain(null);
    expect(conditions).toContain(breakpoints.medium);
  });

  it("заголовок h1 по центру на всех ширинах", async () => {
    await mount();
    const element = heading();

    expect(element.textContent).toBe("Страница не найдена");
    expect(element.getAttribute("aria-level")).toBe("1");
    expect(paintedValue(element, "text-align", 360)).toBe("center");
    expect(paintedValue(element, "text-align", 1280)).toBe("center");
  });

  it("текст и ссылка на месте и тоже по центру", async () => {
    await mount();

    const body = textBlock("Такой страницы нет. Проверьте ссылку.");
    expect(body, "текст пустого состояния").toBeDefined();
    expect(paintedValue(body as HTMLElement, "text-align", 360)).toBe("center");

    const link = container.querySelector('[role="link"]');
    expect(link?.textContent).toBe("На главную");
  });
});
