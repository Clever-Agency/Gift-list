/**
 * Accessibility of the busy spinner, web half.
 *
 * The spinner is decorative: the button already says what is happening with
 * `aria-busy` (`DESIGN.md` → busy), so the browser must not see the drawing at
 * all. `aria-hidden` hides the whole subtree from the accessibility tree, and
 * `focusable="false"` keeps the SVG out of the Tab order of old browsers.
 *
 * React Native's hiding props are not listed here on purpose: on the web they
 * would become stray `accessibility…` attributes of a raw `<svg>` (a Tamagui
 * view strips them through `nativeOnlyProps`, an SVG does not). The phone half
 * is `spinner-a11y.native.ts`.
 */
export function spinnerA11yProps() {
  return { "aria-hidden": true } as const;
}
