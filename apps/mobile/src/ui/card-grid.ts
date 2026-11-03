import { spacing } from "@/theme/tokens";

/** Safe-area insets that eat into the window width, e.g. a notch in landscape. */
export type GridInsets = { left?: number; right?: number };

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
 * `DESIGN.md` → Layout → columns: the content area is the window minus the
 * safe-area insets, the page gutter (16 compact, 24 from medium) and never wider
 * than `max-wide`. Cards keep at least `card-min` with `grid-gap` between them, and
 * there are never more than three. A sidebar or a right column would shrink the
 * content area, and the count follows.
 *
 * Review m7: the safe-area insets are subtracted, the column count stays at least
 * one and the card width never goes negative. A very narrow window gets a card as
 * wide as the screen allows instead of a `card-min` card that overflows.
 */
export function cardGrid(
  windowWidth: number,
  insets: GridInsets = {},
): { columns: number; cardWidth: number } {
  const available = Math.max(
    0,
    windowWidth - Math.max(0, insets.left ?? 0) - Math.max(0, insets.right ?? 0),
  );
  const gutter = pageGutter(windowWidth);
  const content = Math.max(0, Math.min(available, spacing["max-wide"]) - gutter * 2);
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
