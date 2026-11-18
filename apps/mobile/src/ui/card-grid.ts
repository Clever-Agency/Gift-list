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
 * The v8 grid has two widths (`DESIGN.md` → Layout → columns): two columns up to the
 * `expanded` breakpoint and three from it — phones and tablets portrait read as two,
 * a desktop window as three, whatever the wish titles are.
 */
export const GRID_COLUMNS = { compact: 2, wide: 3 } as const;

/**
 * The content width of an `expanded` window (1024 − 2 × 24): the third column appears
 * as soon as the content area is at least this wide. The `expanded` breakpoint is used
 * on purpose — the page gutter does not change there, so the column count cannot
 * disagree between the window-based and the measured (web) path.
 */
const WIDE_CONTENT = spacing["bp-expanded"] - spacing["page-gutter-lg"] * 2;

/**
 * `DESIGN.md` → Layout → columns: two columns on a phone or a tablet, three from the
 * `expanded` breakpoint (`GRID_COLUMNS`), with `grid-gap` between them. `card-min` no
 * longer decides the count — the v8 Pinterest card is narrow by design — but every row
 * is still exactly as wide as the content area it is drawn in.
 *
 * W12.23: the web takes this number from a real layout measurement (`useCardGrid`), so
 * a classic scrollbar — which makes the window wider than the column by its own
 * width — cannot push the cards past the column's right edge. `cardGrid` keeps the
 * window-based form for the phone (where the window is the content area) and as the
 * first-frame fallback on the web.
 *
 * Review m7: the card width never goes negative. A very narrow area gets two cards as
 * wide as it allows instead of one `card-min` card that overflows.
 */
export function cardGridForContent(contentWidth: number): CardGrid {
  const content = Math.max(0, contentWidth);
  const gap = spacing["grid-gap"];
  const columns = content >= WIDE_CONTENT ? GRID_COLUMNS.wide : GRID_COLUMNS.compact;
  return {
    columns,
    cardWidth: Math.max(0, (content - gap * (columns - 1)) / columns),
  };
}

/**
 * `DESIGN.md` → Layout → columns: the content area is the window minus the
 * safe-area insets, the page gutter (16 compact, 24 from medium) and never wider
 * than `max-wide`; the column count comes from that width (2 up to `expanded`, 3 from
 * it). A sidebar or a right column would shrink the content area, and the count
 * follows.
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
