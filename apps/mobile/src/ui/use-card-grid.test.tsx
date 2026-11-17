// @vitest-environment happy-dom
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { observeContentWidth, type SimulatedContent } from "@/test/layout";
import { cardGrid, cardGridForContent } from "@/ui/card-grid";
import { useCardGrid } from "@/ui/use-card-grid";

/**
 * W12.23: on the web the card grid follows the measured content area, not the window.
 *
 * happy-dom has no layout, so nothing measures the container by itself: the tests hand
 * the hook the width a browser would report for the box it watches, exactly what the
 * four screens hand to their content container.
 */
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;
let content: SimulatedContent;
/** Commits of the probe: a measurement that changes nothing must not cause one. */
let commits = 0;

function GridProbe() {
  // Destructured for the same reason the screens do it: a member read of an object that
  // holds a ref callback trips React's `refs` lint rule.
  const { columns, cardWidth, attachContainer } = useCardGrid();
  useEffect(function countCommit() {
    commits += 1;
  });
  return (
    <span
      ref={attachContainer}
      data-testid="grid"
      data-columns={String(columns)}
      data-card-width={String(cardWidth)}
    />
  );
}

GridProbe.displayName = "GridProbe";

/** The numbers the hook returned, read back from what the probe painted. */
function grid(): { columns: number; cardWidth: number } {
  const node = container.querySelector<HTMLElement>('[data-testid="grid"]');
  expect(node, "проба сетки").not.toBeNull();
  return {
    columns: Number((node as HTMLElement).dataset.columns),
    cardWidth: Number((node as HTMLElement).dataset.cardWidth),
  };
}

/**
 * The window width `useWindowDimensions` reads on web: happy-dom keeps
 * `documentElement.clientWidth` at 0 unless a test sets it, and `resize` is what
 * makes react-native-web hand the new value to the mounted hook.
 */
async function setWindowWidth(width: number) {
  Object.defineProperty(document.documentElement, "clientWidth", {
    configurable: true,
    value: width,
  });
  await act(async () => {
    window.dispatchEvent(new Event("resize"));
  });
}

async function mountAt(width: number) {
  await setWindowWidth(width);
  await act(async () => {
    root.render(<GridProbe />);
  });
}

beforeEach(() => {
  commits = 0;
  content = observeContentWidth();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  content.restore();
  Reflect.deleteProperty(document.documentElement, "clientWidth");
  await act(async () => {
    window.dispatchEvent(new Event("resize"));
  });
});

describe("useCardGrid (web)", () => {
  it("до измерения отдаёт прежние числа cardGrid(окно)", async () => {
    await mountAt(600);

    expect(grid()).toEqual(cardGrid(600));
    // The old bug in one number: 552 px of cards for a 537 px column.
    expect(grid().cardWidth).toBe(552);
  });

  it("первый кадр уже по контенту: контейнер измеряется до отрисовки", async () => {
    content.box(537);
    await mountAt(600);

    expect(grid()).toEqual(cardGridForContent(537));
    expect(grid().cardWidth).toBe(537);
  });

  it("после измерения считает от ширины контента: окно 600 px, колонка 537 px", async () => {
    await mountAt(600);
    await content.measure(537);

    expect(grid()).toEqual(cardGridForContent(537));
    expect(grid().cardWidth).toBe(537);
  });

  it.each([
    // Window → content area of the same window without a scrollbar.
    { window: 360, content: 328 },
    { window: 600, content: 552 },
    { window: 1024, content: 976 },
    { window: 1280, content: 1072 },
  ])(
    "окно $window px, контент $content px: числа прежние",
    async ({ window: windowWidth, content: contentWidth }) => {
      await mountAt(windowWidth);
      await content.measure(contentWidth);

      expect(grid()).toEqual(cardGridForContent(contentWidth));
      // Without a scrollbar the content area is the window minus the gutter, so the
      // measured grid is the numbers the window-based helper gave before W12.23.
      expect(grid()).toEqual(cardGrid(windowWidth));
    },
  );

  it("ширина окна после измерения сетку не меняет — решает измерение", async () => {
    await mountAt(600);
    await content.measure(537);

    await setWindowWidth(1280);
    expect(grid().cardWidth).toBe(537);

    // The column itself is what changes the cards.
    await content.measure(1072);
    expect(grid()).toEqual(cardGrid(1280));
  });

  it("то же измерение повторно не перерисовывает, новое — перерисовывает", async () => {
    await mountAt(600);
    await content.measure(537);
    const settled = commits;

    // The browser reports fractional widths and repeats itself: neither may loop.
    await content.measure(537);
    expect(commits).toBe(settled);
    await content.measure(537.2);
    expect(commits).toBe(settled);

    await content.measure(552);
    expect(commits).toBe(settled + 1);
    expect(grid().cardWidth).toBe(552);
  });

  it("нулевая или нечисловая ширина не перетирает запасные числа", async () => {
    await mountAt(600);
    // A hidden or not yet laid out container measures 0.
    await content.measure(0);
    expect(grid()).toEqual(cardGrid(600));

    await content.measure(Number.NaN);
    expect(grid()).toEqual(cardGrid(600));
  });
});
