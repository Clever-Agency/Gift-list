/**
 * Accessibility of the password reveal toggle, phone half.
 *
 * React Native has no `aria-pressed`: `@tamagui/web` lists it as having
 * "no native equivalent" (`src/dom/html.native.tsx:91`), and `aria-*` attributes
 * are DOM props. The state goes through the native `accessibilityState` object
 * instead, whose `checked` member is what React Native paints as a checkable
 * node: Android's `ReactAccessibilityDelegate` sets `isCheckable = true` and
 * `isChecked` from it (`ReactAccessibilityDelegate.kt:637-641`), and iOS appends
 * "checked"/"unchecked" to `accessibilityValue`
 * (`RCTViewComponentView.mm:1604-1611`). TalkBack then announces the toggle as
 * on/off.
 *
 * The role stays `button`: React Native gives the `role` prop precedence over
 * the legacy `accessibilityRole` (`reactnative.dev/docs/accessibility` → `role`,
 * `RCTViewComponentView.mm:67-68`), and the package's shared `Pressable` already
 * defaults `role` to `"button"` (`src/pressable.tsx`). A styled default cannot be
 * cleared by a caller — `mergeProps` keeps a lower layer when the value is
 * `undefined` (`@tamagui/web/src/helpers/mergeProps.ts:5-13`) — so the docs'
 * preferred `togglebutton` role would be shadowed. `button` + `checked` is the
 * combination React Native actually resolves here (see the W9 report).
 */
export function passwordToggleA11yProps(visible: boolean) {
  return {
    role: "button" as const,
    accessibilityState: { checked: visible },
  };
}
