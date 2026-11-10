// @vitest-environment happy-dom
import { breakpoints, spacing } from "@gift-list/ui";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pageGutter } from "@/ui/card-grid";
import { AnonymousScreen } from "@/ui/anonymous-screen";
import { declarationsFor, paintedSpace } from "@/test/tamagui-css";

/**
 * W12.12 (`DESIGN.md` → App → Точки перехода, «Реализация раскладки»): the frame
 * no longer reads the window width in JS. The page gutter is a Tamagui media
 * clause, so the browser turns it into a CSS media query and the phone uses the
 * same key; `pageGutter` stays the source of the numbers for the screens not yet
 * migrated.
 *
 * The widths are checked against the CSS Tamagui actually generated (see
 * `@/test/tamagui-css`), not against a browser layout.
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
    root.render(<AnonymousScreen title="Вход" />);
  });
}

function column(): HTMLElement {
  const node = container.querySelector<HTMLElement>('[name="GLColumn"]');
  expect(node, "колонка формы").not.toBeNull();
  return node as HTMLElement;
}

describe("W12.12: отступ анонимного экрана из медиа-пропсов", () => {
  it("ширина окна из JS не читается", async () => {
    await mount();

    expect(dimensions.calls).toBe(0);
  });

  it("счётчик видит экран, который ширину читает (контроль)", async () => {
    // A probe through the same import the screens use: a zero above means the
    // mock is in place, not that the spy is broken.
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
    const element = column();

    expect(paintedSpace(element, "padding-inline", width)).toBe(pageGutter(width));
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
    // `pageGutter` is the old source and must agree on the same boundary.
    expect(pageGutter(breakpoints.medium - 1)).toBe(spacing["page-gutter"]);
    expect(pageGutter(breakpoints.medium)).toBe(spacing["page-gutter-lg"]);
  });

  it("меняется только на одной медиа-точке, без лишних правил", async () => {
    await mount();
    const gutterRules = declarationsFor(column(), "padding-inline");

    expect(gutterRules).toHaveLength(2);
    const conditions = gutterRules.map((rule) => rule.minWidth);
    expect(conditions).toContain(null);
    expect(conditions).toContain(breakpoints.medium);
  });

  it("каркас на месте: бренд, заголовок и футер", async () => {
    await mount();

    expect(container.textContent).toContain("Gift List");
    expect(container.textContent).toContain("Вход");
    expect(container.querySelector('[role="heading"]')?.textContent).toBe("Gift List");
    expect(container.querySelector('[data-testid="page-footer"]')).not.toBeNull();
  });
});
