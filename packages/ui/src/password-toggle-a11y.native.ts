/**
 * Accessibility of the password reveal toggle, phone half.
 *
 * The toggle is a real toggle button. React Native has no `aria-pressed`:
 * `@tamagui/web` lists it as having "no native equivalent"
 * (`src/dom/html.native.tsx:91`), and `aria-*` attributes are DOM props. The
 * state goes through the native `accessibilityState` object instead, whose
 * `checked` member React Native paints as a checkable node: Android's
 * `ReactAccessibilityDelegate` sets `isCheckable = true` and `isChecked` from it
 * (`ReactAccessibilityDelegate.kt:637-641`), and iOS appends
 * "checked"/"unchecked" to `accessibilityValue`
 * (`RCTViewComponentView.mm:1604-1611`).
 *
 * The role is `togglebutton`, supported on both phones:
 *
 * - Android maps `AccessibilityRole.TOGGLEBUTTON` to
 *   `android.widget.ToggleButton` (`ReactAccessibilityDelegate.kt:457-461`);
 * - iOS has no toggle trait, but `"togglebutton"` resolves to
 *   `UIAccessibilityTraitButton` (`ReactCommon/react/renderer/components/view/
 *   accessibilityPropsConversions.h:30-33`) and `checked` is spoken by the
 *   value, so the announcement stays a button with a state.
 *
 * There is no `role` here on purpose. The ARIA `role` wins over
 * `accessibilityRole` in React Native (`AccessibilityProps.cpp:20-28`), and no
 * `Role` member expresses a toggle button, so a `role: "button"` would shadow
 * the toggle — which is why the shared `Pressable` no longer forces one
 * (`pressable-role.native.ts`). The web keeps `role="button"` + `aria-pressed`
 * (`password-toggle-a11y.ts`).
 */
export function passwordToggleA11yProps(visible: boolean) {
  return {
    accessibilityRole: "togglebutton" as const,
    accessibilityState: { checked: visible },
  };
}
