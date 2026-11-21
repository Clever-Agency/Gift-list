import { YStack } from "@tamagui/stacks";
import type { ReactNode } from "react";
import { Text } from "./text";

export type SidebarProps = {
  /** The product name at the top of the menu (`BRAND_NAME`), `display-sm`. */
  brand: string;
  /** The accessible name of the navigation landmark: «Разделы». */
  label: string;
  /** The `NavItem`s of the sections. */
  children?: ReactNode;
  /** The user card at the bottom of the menu; the caller builds it. */
  footer?: ReactNode;
  testID?: string;
};

/**
 * `DESIGN.md` → `components.sidebar`: the 264 px side menu of expanded and wide
 * screens — `surface`, a 1 px `border` on the right, the brand on top, the
 * sections below and the user card at the bottom. The root is a navigation
 * landmark with the `label`; the sections themselves are `NavItem`s. The menu is
 * not drawn on compact and medium, where the bottom tabs take over.
 */
export function Sidebar({ brand, label, children, footer, testID }: SidebarProps) {
  return (
    <YStack
      render="nav"
      role="navigation"
      aria-label={label}
      testID={testID}
      width="$sidebar"
      height="100%"
      flexShrink={0}
      gap="$4"
      justifyContent="space-between"
      backgroundColor="$surface"
      borderRightWidth={1}
      borderColor="$border"
      paddingVertical={16}
      paddingHorizontal={12}
    >
      <YStack gap="$4">
        <Text kind="display-sm" paddingHorizontal="$3" numberOfLines={1}>
          {brand}
        </Text>
        <YStack gap="$1">{children}</YStack>
      </YStack>
      {footer ? <YStack>{footer}</YStack> : null}
    </YStack>
  );
}

Sidebar.displayName = "Sidebar";
