import { XStack } from "@tamagui/stacks";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { TabBarProps } from "./tab-bar";
import { spacing } from "./tokens";

/**
 * The phone half of `TabBar` (`DESIGN.md` → `components.tab-bar`): the same
 * `surface` strip with the top border, plus the bottom safe area, so the bar
 * stands above the home indicator. The height grows by the inset instead of
 * squeezing the 56 px of content; the sections are announced by the items
 * themselves (`role="tab"`), so the bar takes no landmark role.
 */
export function TabBar({ children, testID }: TabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <XStack
      testID={testID}
      width="100%"
      flexDirection="row"
      justifyContent="space-between"
      alignItems="stretch"
      minHeight={spacing["tab-bar"] + insets.bottom}
      paddingBottom={insets.bottom}
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
