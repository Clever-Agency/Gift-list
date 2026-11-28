import { XStack } from "@tamagui/stacks";
import { cloneElement, isValidElement, type ReactNode } from "react";
import { Badge } from "./badge";
import type { NavItemProps } from "./nav-item";
import { Pressable } from "./pressable";
import { Text } from "./text";
import { useThemeColor } from "./theme-color";

/** The icon keeps the section colour of the item in both themes. */
function tintIcon(icon: ReactNode, color: string): ReactNode {
  if (!isValidElement<{ color?: string }>(icon)) return icon;
  return cloneElement(icon, { color });
}

/**
 * The phone half of `NavItem` (`DESIGN.md` → Навигация приложения): the same
 * tab and side layouts as `nav-item.tsx`, drawn with a `Pressable` because a
 * phone has no anchor. A tab is announced as `role="tab"` with `selected`; the
 * badge count is part of the accessible label («Друзья, 2 запроса»).
 */
export function NavItem({
  label,
  secondary,
  icon,
  badge,
  selected,
  isFocused,
  variant = "tab",
  onPress,
  testID,
}: NavItemProps) {
  const active = selected || Boolean(isFocused);
  const tab = variant === "tab";
  const accessibleName =
    secondary ?? (badge !== undefined && badge > 0 ? `${label}, ${badge}` : label);
  const iconColor = useThemeColor(active ? "primary" : tab ? "muted-foreground" : "foreground");
  const tinted = tintIcon(icon, iconColor);
  const badgeNode = <Badge count={badge ?? 0} testID={testID ? `${testID}-badge` : undefined} />;

  return (
    <Pressable
      role={tab ? "tab" : "link"}
      accessibilityState={tab ? { selected: active } : undefined}
      accessibilityLabel={accessibleName}
      onPress={onPress}
      testID={testID}
      flexDirection={tab ? "column" : "row"}
      alignItems="center"
      justifyContent={tab ? "center" : undefined}
      gap={tab ? "$1" : "$3"}
      minHeight={tab ? "$tab-bar" : "$touch-target"}
      flex={tab ? 1 : undefined}
      paddingHorizontal={tab ? "$1" : 12}
      paddingVertical={tab ? undefined : 10}
      borderRadius={tab ? undefined : "$md"}
      borderTopWidth={tab ? 3 : undefined}
      borderLeftWidth={tab ? undefined : 3}
      borderColor={active ? "$primary" : "transparent"}
      backgroundColor={!tab && active ? "$muted" : "transparent hover:$muted"}
    >
      {tab ? (
        <>
          <XStack alignItems="center" gap="$1">
            {tinted}
            {badgeNode}
          </XStack>
          <Text
            kind="caption"
            tone={active ? "primary" : "muted"}
            fontWeight={active ? "600" : undefined}
            numberOfLines={1}
            maxWidth="100%"
          >
            {label}
          </Text>
        </>
      ) : (
        <>
          {tinted}
          <Text
            kind="label"
            tone={active ? "primary" : "default"}
            fontWeight={active ? "600" : undefined}
            flex={1}
            numberOfLines={1}
          >
            {label}
          </Text>
          {badgeNode}
        </>
      )}
    </Pressable>
  );
}

NavItem.displayName = "NavItem";
