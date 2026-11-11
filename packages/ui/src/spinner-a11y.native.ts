/**
 * Accessibility of the busy spinner, phone half.
 *
 * The drawing is decorative there too — the button is announced with `aria-busy`
 * (`DESIGN.md` → busy) — but React Native has no `aria-hidden` for a view: the
 * subtree is hidden per platform. `accessibilityElementsHidden` is the iOS
 * flag, `importantForAccessibility="no-hide-descendants"` the Android one, and
 * both read the same `aria-hidden` intent.
 *
 * `aria-hidden` is not returned here: `aria-*` are DOM attributes, and the web
 * half `spinner-a11y.ts` carries them. See `password-toggle-a11y.ts` for the
 * same split.
 */
export function spinnerA11yProps() {
  return {
    accessibilityElementsHidden: true,
    importantForAccessibility: "no-hide-descendants",
  } as const;
}
