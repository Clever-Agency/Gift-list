import type { TransitionProp } from "@tamagui/core";

/**
 * A phone has no hover: the colour, shadow and opacity changes of `Pressable` are
 * pressed, not pointed at, so no transition is added (CLE-129). The web half,
 * `hover.ts`, hands the `quick` preset (160 ms) to the CSS driver.
 */
export function hoverTransition(reduce: boolean): TransitionProp | null {
  void reduce;
  return null;
}

export function useHoverTransition(): null {
  return null;
}
