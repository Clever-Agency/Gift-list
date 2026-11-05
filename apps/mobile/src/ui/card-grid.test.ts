import { describe, expect, it } from "vitest";
import { spacing } from "@gift-list/ui";
import { cardGrid, pageGutter } from "@/ui/card-grid";

const gap = spacing["grid-gap"];

/** A laid-out grid must never be wider than the area its container offers. */
function contentWidth(windowWidth: number, insets: { left?: number; right?: number } = {}) {
  const available = windowWidth - (insets.left ?? 0) - (insets.right ?? 0);
  return Math.max(0, Math.min(available, spacing["max-wide"]) - pageGutter(windowWidth) * 2);
}

describe("pageGutter", () => {
  it("is compact below the medium breakpoint and large from it", () => {
    expect(pageGutter(375)).toBe(spacing["page-gutter"]);
    expect(pageGutter(599)).toBe(spacing["page-gutter"]);
    expect(pageGutter(spacing["bp-medium"])).toBe(spacing["page-gutter-lg"]);
  });
});

describe("cardGrid", () => {
  it("keeps one column on a phone", () => {
    expect(cardGrid(375)).toEqual({ columns: 1, cardWidth: 343 });
  });

  it("keeps one column at the 600 breakpoint", () => {
    expect(cardGrid(600).columns).toBe(1);
  });

  it("fits two columns from 640", () => {
    expect(cardGrid(640)).toEqual({ columns: 2, cardWidth: 288 });
  });

  it("stops at three columns and at max-wide", () => {
    expect(cardGrid(1440)).toEqual({ columns: 3, cardWidth: (1120 - 48 - 32) / 3 });
  });

  /**
   * Review m7: the old helper floored the content area at `card-min`, so a 300 px
   * window drew a 280 px card inside a 268 px content area and overflowed.
   */
  it("narrows the single card on a very narrow window instead of overflowing", () => {
    expect(cardGrid(300)).toEqual({ columns: 1, cardWidth: 268 });
  });

  it("fits a 320 px screen in one or two columns that stay inside the content area", () => {
    const grid = cardGrid(320);
    expect(grid.columns).toBeGreaterThanOrEqual(1);
    expect(grid.columns).toBeLessThanOrEqual(2);
    expect(grid.cardWidth * grid.columns + gap * (grid.columns - 1)).toBeLessThanOrEqual(
      contentWidth(320),
    );
  });

  it("takes the safe-area insets out of the available width", () => {
    const notched = cardGrid(640, { left: 44, right: 44 });
    // The notch pulls the content area under two cards, so the second column goes.
    expect(notched.columns).toBe(1);
    expect(notched.cardWidth).toBe(contentWidth(640, { left: 44, right: 44 }));
    expect(notched.cardWidth).toBeLessThan(contentWidth(640));
    // Where the column count holds, the cards themselves get narrower.
    // From `max-wide` the insets stop mattering once the window is wider than the cap
    // plus the insets, so 1150 is still inside the range where they do.
    expect(cardGrid(1150, { left: 44, right: 44 }).cardWidth).toBeLessThan(
      cardGrid(1150).cardWidth,
    );
  });

  it("never returns a negative card width, even when insets exceed the window", () => {
    expect(cardGrid(320, { left: 200, right: 200 })).toEqual({ columns: 1, cardWidth: 0 });
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
        expect(grid.columns).toBeGreaterThanOrEqual(1);
        expect(grid.columns).toBeLessThanOrEqual(3);
        expect(grid.cardWidth).toBeGreaterThanOrEqual(0);
        expect(
          grid.cardWidth * grid.columns + gap * (grid.columns - 1),
        ).toBeLessThanOrEqual(content + 1e-9);
        // Every card but the one-column case still honors the design minimum.
        if (grid.columns > 1) expect(grid.cardWidth).toBeGreaterThanOrEqual(spacing["card-min"]);
      }
    }
  });
});
