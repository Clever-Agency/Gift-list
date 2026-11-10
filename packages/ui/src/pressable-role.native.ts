/**
 * The role of the shared `Pressable`, phone half of the platform pair.
 *
 * React Native 0.88 has two role props: the ARIA `role` and the legacy
 * `accessibilityRole`. `role` wins whenever both are set, in all three places
 * that resolve a role:
 *
 * - the shared props parser derives the traits from `role` first and falls back
 *   to `accessibilityRole` only when `role` is `None`
 *   (`ReactCommon/react/renderer/components/view/AccessibilityProps.cpp:20-28`);
 * - Android reads the `role` tag and only then `accessibility_role`
 *   (`ReactAccessibilityDelegate.kt:551-556`);
 * - iOS builds its role string the same way
 *   (`React/Fabric/Mounting/ComponentViews/View/RCTViewComponentView.mm:1584-1585`).
 *
 * A styled default `role: "button"` therefore shadows every `accessibilityRole`
 * a caller could set. `undefined` cannot remove it either: a lower layer of
 * `mergeProps` survives an `undefined` value from above
 * (`@tamagui/web/src/helpers/mergeProps.ts:5-13`). And the ARIA `role` cannot
 * express a toggle button at all — `facebook::react::Role` has no such member
 * and Android's `fromRole` has no mapping for it
 * (`ReactAccessibilityDelegate.kt:517-544`) — so the toggle has to travel as
 * `accessibilityRole: "togglebutton"`, which this default would have hidden.
 *
 * Hence the phone default is `accessibilityRole: "button"` and no `role`:
 * a caller's `role` (`radio`, `link`, `button`) still beats it on both
 * platforms, and a caller's `accessibilityRole` (`togglebutton`, see
 * `password-toggle-a11y.native.ts`) now reaches React Native. On the web the
 * same surface keeps `role: "button"` (`pressable-role.ts`), so no DOM changes.
 */
export const pressableRole = { accessibilityRole: "button" } as const;
