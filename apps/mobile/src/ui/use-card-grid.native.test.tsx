// @vitest-environment happy-dom
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cardGrid, type CardGridContainer } from "@/ui/card-grid";
import { useCardGrid } from "./use-card-grid.native";

/**
 * W12.23: the phone keeps the numbers it always had. The web hook measures the content
 * area; the Android/iOS hook must stay on `cardGrid(windowWidth, insets)`, so this test
 * imports the `.native` sibling directly (as `clipboard.native.test.ts` does) and
 * compares it with the window-based helper, safe-area insets included.
 */
const safeArea = vi.hoisted(() => ({ insets: { top: 0, right: 0, bottom: 0, left: 0 } }));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => safeArea.insets,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;
let attachContainer: CardGridContainer | null = null;
/** Commits of the probe: the phone's ref must never change the grid. */
let commits = 0;

function GridProbe() {
  // Destructured for the same reason the screens do it: a member read of an object that
  // holds a ref callback trips React's `refs` lint rule.
  const { columns, cardWidth, attachContainer: attach } = useCardGrid();
  useEffect(function rememberAttach() {
    attachContainer = attach;
    commits += 1;
  });
  return (
    <span
      data-testid="grid"
      data-columns={String(columns)}
      data-card-width={String(cardWidth)}
    />
  );
}

GridProbe.displayName = "GridProbe";

function grid(): { columns: number; cardWidth: number } {
  const node = container.querySelector<HTMLElement>('[data-testid="grid"]');
  expect(node, "проба сетки").not.toBeNull();
  return {
    columns: Number((node as HTMLElement).dataset.columns),
    cardWidth: Number((node as HTMLElement).dataset.cardWidth),
  };
}

/** The window width `useWindowDimensions` delivers; `resize` re-renders the probe. */
async function mountAt(width: number) {
  Object.defineProperty(document.documentElement, "clientWidth", {
    configurable: true,
    value: width,
  });
  await act(async () => {
    window.dispatchEvent(new Event("resize"));
  });
  await act(async () => {
    root.render(<GridProbe />);
  });
}

beforeEach(() => {
  commits = 0;
  attachContainer = null;
  safeArea.insets = { top: 0, right: 0, bottom: 0, left: 0 };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  Reflect.deleteProperty(document.documentElement, "clientWidth");
  await act(async () => {
    window.dispatchEvent(new Event("resize"));
  });
});

describe("useCardGrid (native)", () => {
  it.each([360, 600, 1024, 1280])(
    "окно %ipx: те же числа, что cardGrid(width) — без измерения",
    async (width) => {
      await mountAt(width);

      expect(grid()).toEqual(cardGrid(width));
      // The explicit numbers of the phone build: one column on a 360 phone, three
      // from a 1024 tablet.
      expect(grid().columns).toBe(width < 1024 ? 1 : 3);
    },
  );

  it.each([640, 1150])(
    "окно %ipx с вырезами: те же числа, что cardGrid(width, insets)",
    async (width) => {
      safeArea.insets = { top: 0, right: 44, bottom: 0, left: 44 };
      await mountAt(width);

      expect(grid()).toEqual(cardGrid(width, { left: 44, right: 44 }));
      // The insets really reach the numbers: a notch pulls a 640 px window under
      // two columns.
      expect(grid()).not.toEqual(cardGrid(width));
    },
  );

  it("ref контейнера на телефоне ничего не меняет и не перерисовывает", async () => {
    await mountAt(1024);
    const before = grid();
    const settled = commits;

    await act(async () => {
      attachContainer?.(container);
    });

    expect(grid()).toEqual(before);
    expect(grid()).toEqual(cardGrid(1024));
    expect(commits).toBe(settled);
  });
});
