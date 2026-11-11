// @vitest-environment happy-dom
import { breakpoints, spacing } from "@gift-list/ui";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { declarationsFor, paintedSpace, paintedValue } from "@/test/tamagui-css";
import { cardGrid, pageGutter } from "@/ui/card-grid";
import { SessionLoadingScreen } from "@/ui/session-loading-screen";

/**
 * W12.15 (the last screen of the per-screen migration W12.12–W12.14): the gutter
 * is the Tamagui media clause `$page-gutter medium:$page-gutter-lg`, so the
 * browser turns it into a CSS media query and the phone uses the same key.
 *
 * A form skeleton no longer takes a number: it is `width="100%"` of the column
 * content box, and that box still adds up to the old
 * `min(window, max-form) − 2·gutter`. The wide grid keeps `cardGrid` — its column
 * count is grid math (`DESIGN.md` → Layout → columns), not a CSS breakpoint — so
 * the window width is still read for it, and the grid and the CSS gutter are
 * checked to agree on the same 600 boundary.
 *
 * Widths come from the CSS Tamagui actually generated (see `@/test/tamagui-css`),
 * not from a browser layout: real rendering on a phone and in a browser is a
 * manual check.
 */

/** The window width the screen sees; `calls` proves the probe hits this mock. */
const viewport = vi.hoisted(() => ({ width: 1024, calls: 0 }));

vi.mock("react-native", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-native")>();
  function useWindowDimensions() {
    viewport.calls += 1;
    return { ...actual.useWindowDimensions(), width: viewport.width };
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

beforeEach(() => {
  viewport.width = 1024;
  viewport.calls = 0;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("SessionLoadingScreen", () => {
  it("широкий экран: одна прокрутка страницы, живая область и три скелетона", async () => {
    await mount(<SessionLoadingScreen />);

    const page = container.querySelector<HTMLElement>('[data-testid="session-loading-page"]');
    expect(page).not.toBeNull();
    expect(getComputedStyle(page as Element).overflowY).toBe("auto");

    const region = container.querySelector<HTMLElement>('[data-testid="session-loading"]');
    expect(region).not.toBeNull();
    expect(region?.getAttribute("role")).toBe("status");
    expect(region?.getAttribute("aria-busy")).toBe("true");
    expect(region?.getAttribute("aria-label")).toBe("Загружаем");
    expect(container.querySelectorAll('[data-testid="wish-card-skeleton"]')).toHaveLength(3);

    const footer = container.querySelector<HTMLElement>('[data-testid="page-footer"]');
    expect(footer).not.toBeNull();
    expect(footer?.getAttribute("role")).toBe("contentinfo");
    expect(footer?.textContent).toContain("Сделано с любовью командой cleverAgency");

    const scrollers = Array.from(container.querySelectorAll("*")).filter((node) =>
      ["auto", "scroll"].includes(getComputedStyle(node).overflowY),
    );
    expect(scrollers).toEqual([page]);
  });

  it("форма: одна карточка-скелетон и тот же стабильный testID", async () => {
    await mount(<SessionLoadingScreen size="form" />);

    expect(container.querySelector('[data-testid="session-loading"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-testid="wish-card-skeleton"]')).toHaveLength(1);
  });
});

/** The one `GLColumn` of the page: the column whose padding is the page gutter. */
function column(): HTMLElement {
  const node = container.querySelector<HTMLElement>('[name="GLColumn"]');
  expect(node, "колонка страницы").not.toBeNull();
  return node as HTMLElement;
}

/** The first skeleton card; the grid paints it with the width the screen passed. */
function card(): HTMLElement {
  const node = container.querySelector<HTMLElement>('[data-testid="wish-card-skeleton"]');
  expect(node, "карточка-скелетон").not.toBeNull();
  return node as HTMLElement;
}

/** Mounts the screen at one column size and one window width. */
async function mountAt(width: number, size?: "form" | "wide") {
  viewport.width = width;
  await mount(<SessionLoadingScreen size={size} />);
}

/** Replaces the mounted screen with a fresh one at another width/size. */
async function remountAt(width: number, size?: "form" | "wide") {
  await act(async () => root.unmount());
  root = createRoot(container);
  await mountAt(width, size);
}

/**
 * The old JS formula for a form skeleton, kept as the reference the CSS column has
 * to reproduce: `min(window, max-form) − 2·gutter`.
 */
function oldFormCardWidth(width: number): number {
  return Math.max(0, Math.min(width, spacing["max-form"]) - pageGutter(width) * 2);
}

/** The width the skeleton card is painted with, as a number (`100%` has none). */
function paintedCardWidth(width: number): number {
  return Number.parseFloat(paintedValue(card(), "width", width) ?? "");
}

/**
 * The column `max-width` is a size token (`var(--t-size-max-form)`), which the
 * shared `paintedSpace` does not resolve; the value lives in `spacing` all the same.
 */
function paintedMaxWidth(width: number): number | undefined {
  const token = paintedValue(column(), "max-width", width)?.match(/var\(--t-size-([\w-]+)\)/)?.[1];
  return token === undefined ? undefined : spacing[token as keyof typeof spacing];
}

describe("W12.15: SessionLoadingScreen на медиа-пропсах", () => {
  it("мок ширины окна живой: проба через тот же импорт видит заданное значение", async () => {
    // The form no longer reads the width, but the hook stays unconditional, so a
    // zero call count would prove nothing; the probe shows the value is delivered.
    const { useWindowDimensions } = await import("react-native");
    function Probe() {
      return <span>{String(useWindowDimensions().width)}</span>;
    }
    viewport.width = 777;
    await act(async () => root.render(<Probe />));

    expect(container.textContent).toBe("777");
    expect(viewport.calls).toBeGreaterThan(0);
  });

  describe.each(["form", "wide"] as const)("size=%s", (size) => {
    it.each([360, 600, 1024, 1280])("ширина %ipx: отступ как у pageGutter", async (width) => {
      await mountAt(width, size);

      expect(paintedSpace(column(), "padding-inline", width)).toBe(pageGutter(width));
    });

    it("граница одна и та же: 16 до bp-medium, 24 от bp-medium", async () => {
      await mountAt(360, size);
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
      await mountAt(360, size);
      const gutterRules = declarationsFor(column(), "padding-inline");

      expect(gutterRules).toHaveLength(2);
      const conditions = gutterRules.map((rule) => rule.minWidth);
      expect(conditions).toContain(null);
      expect(conditions).toContain(breakpoints.medium);
    });
  });

  it.each([360, 600, 1024, 1280])(
    "форма на %ipx: карточка на всю колонку, а колонка даёт прежнюю формулу",
    async (width) => {
      await mountAt(width, "form");

      // The card has no pixel width any more: it fills the column content box.
      expect(paintedValue(card(), "width", width)).toBe("100%");
      expect(paintedMaxWidth(width)).toBe(spacing["max-form"]);

      // That box is the old formula: `max-form` capped to the window, minus the gutter.
      const content = Math.min(width, paintedMaxWidth(width) ?? width) -
        (paintedSpace(column(), "padding-inline", width) ?? 0) * 2;
      expect(content).toBe(oldFormCardWidth(width));
    },
  );

  it.each([360, 600, 1024, 1280])(
    "wide на %ipx: ширина карточки — прежняя формула cardGrid",
    async (width) => {
      await mountAt(width, "wide");

      // The grid is the one place that still needs the window: the count and the
      // width of its cards come from `cardGrid`, not from a CSS breakpoint.
      expect(paintedCardWidth(width)).toBeCloseTo(cardGrid(width).cardWidth, 5);
    },
  );

  it("форма не зависит от ширины окна: та же карточка при 360 и 1280", async () => {
    await mountAt(360, "form");
    const narrowCard = card().className;
    const narrowRules = declarationsFor(column(), "padding-inline").map(
      (rule) => `${rule.minWidth}:${rule.value}`,
    );

    await remountAt(1280, "form");

    expect(card().className).toBe(narrowCard);
    expect(
      declarationsFor(column(), "padding-inline").map((rule) => `${rule.minWidth}:${rule.value}`),
    ).toEqual(narrowRules);
  });

  it("контроль: у wide ширина окна до карточки доходит", async () => {
    await mountAt(360, "wide");
    const narrowCard = card().className;

    await remountAt(1280, "wide");

    expect(card().className).not.toBe(narrowCard);
  });

  it("число карточек скелета: одна для формы, три для wide", async () => {
    await mountAt(1024, "form");
    expect(container.querySelectorAll('[data-testid="wish-card-skeleton"]')).toHaveLength(1);

    await remountAt(1024, "wide");
    expect(container.querySelectorAll('[data-testid="wish-card-skeleton"]')).toHaveLength(3);
  });

  it.each([breakpoints.medium - 1, breakpoints.medium])(
    "на границе %ipx сетка и CSS-отступ согласованы: карточка с отступами не шире колонки",
    async (width) => {
      await mountAt(width, "wide");
      const cssGutter = paintedSpace(column(), "padding-inline", width) ?? 0;

      // One and the same 600 boundary in `cardGrid` and in the media clause.
      expect(cssGutter).toBe(pageGutter(width));
      expect(paintedCardWidth(width)).toBeCloseTo(cardGrid(width).cardWidth, 5);

      const columnWidth = Math.min(width, spacing["max-wide"]);
      expect(cardGrid(width).cardWidth + cssGutter * 2).toBeLessThanOrEqual(columnWidth);
    },
  );
});
