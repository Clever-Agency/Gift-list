import { useMedia, View } from "@tamagui/core";
import { XStack, YStack } from "@tamagui/stacks";
import type { ReactNode } from "react";
import { SkipLink } from "./skip-link";
import { TabBarInsetContext } from "./shell-inset";
import { spacing } from "./tokens";

export { useTabBarInset } from "./shell-inset";

export type AppShellProps = {
  /** The side menu of expanded screens; the caller builds it (`SidebarNav`). */
  sidebar?: ReactNode;
  /**
   * The bottom bar of compact and medium; it stays mounted on every width. An
   * anonymous screen passes no bar at all, and the shell then reserves no height
   * for it.
   */
  tabBar?: ReactNode;
  /** The text of the skip link: `web.skipToContent` — «Перейти к содержимому». */
  skipLabel: string;
  /** The screen or the tabs' slot. */
  children?: ReactNode;
  testID?: string;
};

/**
 * `DESIGN.md` → Навигация приложения: the one frame of the signed-in app. The
 * skip link is the first stop of the Tab order and jumps to the only `main`
 * landmark (`#main-content`, `tabIndex={-1}`); below it sit the side menu (from
 * `expanded`, 1024 px) and the content, and the bottom tabs stay under the
 * content on compact and medium.
 *
 * The bar is mounted on every width and only hidden on `expanded`, so a resize
 * never flashes its items away. The bar's height is published through
 * `useTabBarInset`: a toast stands above it, and a screen lets the bar keep the
 * bottom safe-area inset. The side menu is drawn only when the screen is wide
 * enough, and an anonymous screen passes neither navigation, so the shell
 * reserves no height for the missing bar.
 */
export function AppShell({ sidebar, tabBar, skipLabel, children, testID }: AppShellProps) {
  const expanded = useMedia().expanded;
  const showSidebar = expanded && sidebar !== undefined;
  // No bar — an anonymous screen — reserves no height either, so a screen keeps
  // its own bottom safe-area inset.
  const inset = expanded || tabBar === undefined ? 0 : spacing["tab-bar"];

  return (
    <TabBarInsetContext.Provider value={inset}>
      <YStack flex={1} testID={testID}>
        <SkipLink label={skipLabel} testID={testID ? `${testID}-skip` : undefined} />
        <XStack flex={1} minHeight={0} alignItems="stretch">
          {showSidebar ? (
            <View
              testID={testID ? `${testID}-sidebar` : undefined}
              display="flex"
              flexShrink={0}
              alignSelf="stretch"
            >
              {sidebar}
            </View>
          ) : null}
          <View
            render="main"
            id="main-content"
            tabIndex={-1}
            testID={testID ? `${testID}-main` : undefined}
            flex={1}
            minWidth={0}
          >
            {children}
          </View>
        </XStack>
        <View
          testID={testID ? `${testID}-tab-bar` : undefined}
          display={expanded ? "none" : "flex"}
          flexShrink={0}
        >
          {tabBar}
        </View>
      </YStack>
    </TabBarInsetContext.Provider>
  );
}

AppShell.displayName = "AppShell";
