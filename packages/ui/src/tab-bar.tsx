import { XStack } from "@tamagui/stacks";
import type { ReactNode } from "react";

export type TabBarProps = {
  /** The accessible name of the bar: «Разделы» (`EXPERIENCE.md` → Доступность). */
  label: string;
  /** The five `NavItem`s in the order of `UX-A13`. */
  children?: ReactNode;
  testID?: string;
};

/**
 * `DESIGN.md` → `components.tab-bar`: the bottom bar of compact and medium — a
 * `surface` strip with a 1 px top `border` and the height of `spacing.tab-bar`.
 * On the web the root is a real `<nav aria-label>` with links inside; the phone
 * takes `tab-bar.native.tsx`, which also keeps the home indicator with its own
 * bottom inset. The bar itself is a landmark, not a `tablist`: the sections are
 * URL transitions (`EXPERIENCE.md` → Доступность → Навигация).
 */
export function TabBar({ label, children, testID }: TabBarProps) {
  return (
    <XStack
      render="nav"
      aria-label={label}
      testID={testID}
      width="100%"
      flexDirection="row"
      justifyContent="space-between"
      alignItems="stretch"
      minHeight="$tab-bar"
      borderTopWidth={1}
      borderColor="$border"
      backgroundColor="$surface"
      flexShrink={0}
    >
      {children}
    </XStack>
  );
}

TabBar.displayName = "TabBar";
