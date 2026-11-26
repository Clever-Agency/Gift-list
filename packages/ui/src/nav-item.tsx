import { View } from "@tamagui/core";
import { XStack } from "@tamagui/stacks";
import {
  cloneElement,
  forwardRef,
  isValidElement,
  type ComponentRef,
  type ReactNode,
} from "react";
import { Badge } from "./badge";
import { focusRing } from "./focus-ring";
import { useHoverTransition } from "./hover";
import { Text } from "./text";
import { useThemeColor } from "./theme-color";

export type NavItemVariant = "tab" | "side";

export type NavItemProps = {
  /** The visible label. A tab uses the short form («Брони»), a sidebar item the full one. */
  label: string;
  /**
   * The full accessible name when the visible label is shortened, e.g. «Мои
   * брони» for the «Брони» tab or «Друзья, 2 запроса» with the badge. Without it
   * the name is the label, plus the badge count when there is one.
   */
  secondary?: string;
  /** The section glyph, handed in by the screen (`Heart`, `Search`, …). */
  icon: ReactNode;
  /** The count in the badge; 0 and undefined draw no badge. */
  badge?: number;
  /** The section is the current one. */
  selected: boolean;
  /** `TabTrigger asChild` marks the active route with it; it counts as selected. */
  isFocused?: boolean;
  variant?: NavItemVariant;
  /**
   * The section address. The browser draws a real `<a href>` and the link itself
   * navigates; the phone has no anchor and uses `onPress`.
   */
  href?: string;
  onPress?: (event?: unknown) => void;
  testID?: string;
};

/** The icon keeps the section colour of the item in both themes. */
function tintIcon(icon: ReactNode, color: string): ReactNode {
  if (!isValidElement<{ color?: string }>(icon)) return icon;
  return cloneElement(icon, { color });
}

/**
 * `DESIGN.md` → Навигация приложения, `components.tab-bar` and
 * `components.nav-item`: one item of the bottom tabs or of the side menu. The
 * selected section is marked by a 3 px `primary` bar, weight 600 and the
 * `primary` colour — never by colour alone — and it also carries `aria-current`
 * (web) / `selected` (phone).
 *
 * The browser half of the platform pair: the root is a real `<a href>`, so
 * «открыть в новой вкладке» and the context menu work without the router. The
 * phone takes `nav-item.native.tsx` (`Pressable` with `role="tab"`).
 */
export const NavItem = forwardRef<ComponentRef<typeof View>, NavItemProps>(function NavItem(
  {
    label,
    secondary,
    icon,
    badge,
    selected,
    isFocused,
    variant = "tab",
    href,
    onPress,
    testID,
  },
  ref,
) {
  const active = selected || Boolean(isFocused);
  const tab = variant === "tab";
  const transition = useHoverTransition();
  const accessibleName =
    secondary ?? (badge !== undefined && badge > 0 ? `${label}, ${badge}` : label);
  const iconColor = useThemeColor(active ? "primary" : tab ? "muted-foreground" : "foreground");
  const tinted = tintIcon(icon, iconColor);
  const anchor = { href, "aria-current": active ? "page" : undefined };
  const badgeNode = <Badge count={badge ?? 0} testID={testID ? `${testID}-badge` : undefined} />;

  return (
    <View
      ref={ref}
      render="a"
      {...anchor}
      aria-label={accessibleName === label ? undefined : accessibleName}
      onPress={onPress}
      testID={testID}
      display="flex"
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
      // The hover fill is `$muted`, not the page `$background`: on the page the
      // latter is invisible (CLE-129). The active section keeps its own fill.
      backgroundColor={!tab && active ? "$muted" : "transparent hover:$muted"}
      cursor="pointer"
      textDecorationLine="none"
      // The root is a real `<a>`: without it the browser paints the link
      // `:link/:visited/:active` colours (red on press) and any glyph that
      // falls back to `currentColor` turns red. `inherit` keeps the look.
      color="inherit"
      opacity="press:0.9"
      transition={transition}
      {...focusRing}
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
    </View>
  );
});

NavItem.displayName = "NavItem";
