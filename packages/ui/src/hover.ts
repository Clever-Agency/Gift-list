import type { TransitionProp } from "@tamagui/core";
import { useReduceMotion } from "./use-reduce";

/**
 * `DESIGN.md` → Движение: a colour, a shadow or an opacity changes smoothly — the
 * Tamagui `quick` preset, 160 ms (CLE-129). The list is the old `animateOnly` of
 * Tamagui 2 in its v3 spelling: a hover only paints these properties, so a layout
 * change never glides.
 */
const HOVER_PROPERTIES = "backgroundColor, borderColor, boxShadow, opacity, color";

const HOVER_TRANSITION: TransitionProp = {
  preset: "quick",
  properties: HOVER_PROPERTIES,
};

/**
 * The transition of a hover / press change. One object for every component, so the
 * animation driver resolves it once. With «уменьшить движение» the change is
 * instant: the CSS driver writes no `transition` at all.
 */
export function hoverTransition(reduce: boolean): TransitionProp | null {
  return reduce ? null : HOVER_TRANSITION;
}

/**
 * The same transition for a component body: it follows the `reduce` media of the
 * theme, so the component does not pass the flag around (`use-reduce.ts`).
 */
export function useHoverTransition(): TransitionProp | null {
  return hoverTransition(useReduceMotion());
}
