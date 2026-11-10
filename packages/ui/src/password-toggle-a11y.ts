/**
 * Accessibility of the password reveal toggle, web half.
 *
 * The button is an ordinary toggle button: `role="button"` plus `aria-pressed`,
 * which is exactly the ARIA pattern for a button whose pressed state changes
 * (`https://www.w3.org/WAI/ARIA/apg/patterns/button/`). React Native's own
 * mapping has no native equivalent for `aria-pressed`
 * (`@tamagui/web/src/dom/html.native.tsx:91`), so the phone gets the state
 * through `accessibilityState` instead — see `password-toggle-a11y.native.ts`.
 */
export function passwordToggleA11yProps(visible: boolean) {
  return {
    role: "button" as const,
    "aria-pressed": visible,
  };
}
