import { describe, expect, it } from "vitest";
import { spacing } from "@gift-list/ui";
import { cardGrid, cardGridForContent, GRID_COLUMNS, pageGutter } from "@/ui/card-grid";

const gap = spacing["grid-gap"];

/** A laid-out grid must never be wider than the area its container offers. */
function contentWidth(windowWidth: number, insets: { left?: number; right?: number } = {}) {
  const available = windowWidth - (insets.left ?? 0) - (insets.right ?? 0);
  return Math.max(0, Math.min(available, spacing["max-wide"]) - pageGutter(windowWidth) * 2);
}

/** Two cards in the content area the v8 grid gives them. */
function twoColumns(content: number): number {
  return (content - gap) / 2;
}

describe("pageGutter", () => {
  it("is compact below the medium breakpoint and large from it", () => {
    expect(pageGutter(375)).toBe(spacing["page-gutter"]);
    expect(pageGutter(599)).toBe(spacing["page-gutter"]);
    expect(pageGutter(spacing["bp-medium"])).toBe(spacing["page-gutter-lg"]);
  });
});

describe("cardGrid", () => {
  it("keeps two columns on a phone", () => {
    expect(cardGrid(375)).toEqual({ columns: 2, cardWidth: twoColumns(343) });
  });

  it("switches to three columns at the 1024 breakpoint", () => {
    // 1023 − 2·24 = 975 px of content; 1024 − 2·24 = 976 px.
    expect(cardGrid(1023).columns).toBe(2);
    expect(cardGrid(1024).columns).toBe(3);
    expect(cardGrid(600).columns).toBe(2);
  });

  it("stays at three columns and at max-wide", () => {
    expect(cardGrid(1440)).toEqual({ columns: 3, cardWidth: (1120 - 48 - 32) / 3 });
  });

  /**
   * Review m7: the card width never goes negative. A very narrow area gets two cards
   * as wide as it allows instead of a `card-min` card that overflows.
   */
  it("narrows the two cards on a very narrow window instead of overflowing", () => {
    expect(cardGrid(300)).toEqual({ columns: 2, cardWidth: twoColumns(268) });
  });

  it("fits a 320 px screen in two columns that stay inside the content area", () => {
    const grid = cardGrid(320);
    expect(grid.columns).toBe(2);
    expect(grid.cardWidth * grid.columns + gap * (grid.columns - 1)).toBeLessThanOrEqual(
      contentWidth(320),
    );
  });

  it("takes the safe-area insets out of the available width", () => {
    const notched = cardGrid(1200, { left: 44, right: 44 });
    // The notch narrows the column (1112 px, below the max-wide cap), so the cards get
    // narrower; the 3-column count holds at 1064 px of content.
    expect(notched.columns).toBe(3);
    expect(notched.cardWidth).toBeLessThan(cardGrid(1200).cardWidth);
    // A notch on a tablet keeps the two columns but narrows them.
    expect(cardGrid(768, { left: 44, right: 44 }).columns).toBe(2);
    expect(cardGrid(768, { left: 44, right: 44 }).cardWidth).toBeLessThan(
      cardGrid(768).cardWidth,
    );
  });

  it("never returns a negative card width, even when insets exceed the window", () => {
    expect(cardGrid(320, { left: 200, right: 200 })).toEqual({ columns: 2, cardWidth: 0 });
  });

  it("keeps every column count inside the content area across widths and insets", () => {
    const insets = [
      undefined,
      { left: 0, right: 0 },
      { left: 44, right: 44 },
      { left: 24, right: 0 },
    ];
    for (let windowWidth = 280; windowWidth <= 1600; windowWidth += 20) {
      for (const inset of insets) {
        const grid = cardGrid(windowWidth, inset);
        const content = contentWidth(windowWidth, inset);
        expect(grid.columns).toBeGreaterThanOrEqual(GRID_COLUMNS.compact);
        expect(grid.columns).toBeLessThanOrEqual(GRID_COLUMNS.wide);
        expect(grid.cardWidth).toBeGreaterThanOrEqual(0);
        expect(
          grid.cardWidth * grid.columns + gap * (grid.columns - 1),
        ).toBeLessThanOrEqual(content + 1e-9);
        // The third column appears exactly from the content width of an `expanded` window.
        expect(grid.columns).toBe(
          content >= spacing["bp-expanded"] - spacing["page-gutter-lg"] * 2
            ? GRID_COLUMNS.wide
            : GRID_COLUMNS.compact,
        );
      }
    }
  });
});

/**
 * W12.23: on the web the grid takes its numbers from the measured content area, not
 * from the window. The boundaries are the ones the coordinator measured in a browser:
 * a 600 px window with a classic ~15 px scrollbar leaves a 585 px column, so the cards
 * get 585 − 2·24 = 537 px; the same window without a scrollbar leaves 552 px.
 *
 * v8: the column count no longer follows `card-min`; the content area only decides
 * between two and three columns (`GRID_COLUMNS`).
 */
describe("cardGridForContent", () => {
  const WIDE = spacing["bp-expanded"] - spacing["page-gutter-lg"] * 2;

  it.each([
    // Content width → what the cards get from it (gap 16).
    { content: 328, columns: 2 }, // 360 window, 16 px gutter
    { content: 537, columns: 2 }, // 600 window with a scrollbar: 585 − 2·24
    { content: 552, columns: 2 }, // 600 window, no scrollbar
    { content: WIDE - 1, columns: 2 }, // 975: one px under the third column
    { content: WIDE, columns: 3 }, // 976: the content area of an expanded window
    { content: 1072, columns: 3 }, // 1280 window capped at max-wide − 2·24
  ])(
    "$content px: $columns колонки, ряд не шире области контента",
    ({ content, columns }) => {
      const grid = cardGridForContent(content);

      expect(grid.columns).toBe(columns);
      expect(grid.cardWidth).toBeCloseTo((content - gap * (columns - 1)) / columns, 10);
      expect(grid.cardWidth * grid.columns + gap * (grid.columns - 1)).toBeLessThanOrEqual(
        content + 1e-9,
      );
    },
  );

  it("narrows the two cards instead of overflowing when the area is tiny", () => {
    expect(cardGridForContent(200)).toEqual({ columns: 2, cardWidth: twoColumns(200) });
    expect(cardGridForContent(0)).toEqual({ columns: 2, cardWidth: 0 });
    expect(cardGridForContent(-10)).toEqual({ columns: 2, cardWidth: 0 });
  });

  /**
   * The window-based helper stays the source of the phone's numbers and of the web's
   * first frame: it only derives the content width and hands it to the same math, so
   * the two can never disagree.
   */
  it("is the same math as `cardGrid`: only the source of the width differs", () => {
    for (let windowWidth = 280; windowWidth <= 1600; windowWidth += 20) {
      for (const inset of [undefined, { left: 44, right: 44 }, { left: 24, right: 0 }]) {
        expect(cardGridForContent(contentWidth(windowWidth, inset))).toEqual(
          cardGrid(windowWidth, inset),
        );
      }
    }
  });
});
