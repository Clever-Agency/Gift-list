import { spacing } from "@gift-list/ui";

/** Safe-area insets that eat into the window width, e.g. a notch in landscape. */
export type GridInsets = { left?: number; right?: number };

/** The grid numbers a screen draws with: how many columns, and how wide each card. */
export type CardGrid = { columns: number; cardWidth: number };

/**
 * The ref a screen puts on the container the cards are drawn in: the web measures its
 * box, the phone ignores it. The parameter is `unknown` because the two platforms hand
 * a different element to the same ref (a DOM node and a native view).
 */
export type CardGridContainer = (element: unknown) => void;

/**
 * What `useCardGrid` hands a screen: the numbers, and the ref to put on the container
 * they are counted for. A screen destructures it instead of reading members: React's
 * `refs` lint rule treats an object that holds a ref callback as a ref, and a member
 * read of it during render is an error.
 */
export type CardGridPlacement = CardGrid & { attachContainer: CardGridContainer };

/**
 * `DESIGN.md` → Layout → breakpoints: the page gutter is 16 on compact and 24 from
 * `bp-medium`. One source for both the column padding and the grid math, so the
 * cards can never be laid out for a wider area than they are drawn in.
 */
export function pageGutter(windowWidth: number): number {
  return windowWidth >= spacing["bp-medium"]
    ? spacing["page-gutter-lg"]
    : spacing["page-gutter"];
}

/**
 * `DESIGN.md` → Layout → columns: cards keep at least `card-min` with `grid-gap`
 * between them, and there are never more than three. The input is the width of the
 * content area itself — the column the cards are drawn in, already without the page
 * gutter, the `max-wide` cap and the safe area.
 *
 * W12.23: the web takes this number from a real layout measurement (`useCardGrid`), so
 * a classic scrollbar — which makes the window wider than the column by its own
 * width — cannot push the cards past the column's right edge. `cardGrid` keeps the
 * window-based form for the phone (where the window is the content area) and as the
 * first-frame fallback on the web.
 *
 * Review m7: the column count stays at least one and the card width never goes
 * negative. A very narrow area gets a card as wide as it allows instead of a
 * `card-min` card that overflows.
 */
export function cardGridForContent(contentWidth: number): CardGrid {
  const content = Math.max(0, contentWidth);
  const gap = spacing["grid-gap"];
  const columns = Math.max(
    1,
    Math.min(3, Math.floor((content + gap) / (spacing["card-min"] + gap))),
  );
  return {
    columns,
    cardWidth: Math.max(0, (content - gap * (columns - 1)) / columns),
  };
}

/**
 * `DESIGN.md` → Layout → columns: the content area is the window minus the
 * safe-area insets, the page gutter (16 compact, 24 from medium) and never wider
 * than `max-wide`. Cards keep at least `card-min` with `grid-gap` between them, and
 * there are never more than three. A sidebar or a right column would shrink the
 * content area, and the count follows.
 *
 * The grid math itself lives in `cardGridForContent`: this function only derives
 * the content width from the window. That is exactly right on the phone; on the web
 * the window is not the content area (a scrollbar takes its share), so the screens
 * measure it instead — see `useCardGrid`.
 */
export function cardGrid(windowWidth: number, insets: GridInsets = {}): CardGrid {
  const available = Math.max(
    0,
    windowWidth - Math.max(0, insets.left ?? 0) - Math.max(0, insets.right ?? 0),
  );
  const gutter = pageGutter(windowWidth);
  const content = Math.max(0, Math.min(available, spacing["max-wide"]) - gutter * 2);
  return cardGridForContent(content);
}
