import { spacing } from "@/theme/tokens";

/**
 * `DESIGN.md` → Layout → columns: the content area is the window minus the page
 * gutter (16 compact, 24 from medium), never wider than `max-wide`. Cards keep at
 * least `card-min` with `grid-gap` between them, and there are never more than three.
 * A sidebar or a right column would shrink the content area, and the count follows.
 */
export function cardGrid(windowWidth: number): { columns: number; cardWidth: number } {
  const gutter =
    windowWidth >= spacing["bp-medium"] ? spacing["page-gutter-lg"] : spacing["page-gutter"];
  const content = Math.max(
    spacing["card-min"],
    Math.min(windowWidth, spacing["max-wide"]) - gutter * 2,
  );
  const gap = spacing["grid-gap"];
  const columns = Math.max(
    1,
    Math.min(3, Math.floor((content + gap) / (spacing["card-min"] + gap))),
  );
  return { columns, cardWidth: (content - gap * (columns - 1)) / columns };
}
