import { useMedia } from "@tamagui/core";

/**
 * «Уменьшить движение» (DESIGN.md → Движение): the `reduce` media key of
 * `createGiftListConfig`. On the web it is `prefers-reduced-motion: reduce`, on a
 * phone `AccessibilityInfo.isReduceMotionEnabled` through the Tamagui media
 * driver, so one hook covers both runtimes.
 *
 * Components gate their transitions and animations on it (W12.7, W12.8).
 */
export function useReduceMotion(): boolean {
  return Boolean(useMedia().reduce);
}
