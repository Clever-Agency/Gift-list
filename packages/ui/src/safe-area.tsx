import { YStack } from "@tamagui/stacks";
import type { SafeAreaProps } from "./safe-area.types";

/**
 * The safe frame of a screen: what every screen used to write by hand as
 * `<SafeAreaView style={{ flex: 1 }}>`. The native twin is `safe-area.native.tsx`;
 * it hands the insets to `react-native-safe-area-context`, which this file cannot
 * import without pulling `react-native` into the web bundle — `apps/web` imports the
 * package root.
 *
 * The browser loses nothing: the library reads `env(safe-area-inset-*)`, and the
 * exported page has no `viewport-fit=cover` in its viewport meta, so every inset is
 * already 0 there. The wrapper draws the same plain flex column the library draws on
 * the web — React Native's `flex: 1`, written as its three longhands — and does not
 * nest safe areas: a screen places it once, under `Screen`.
 */
export function SafeArea({ children }: SafeAreaProps) {
  return (
    <YStack flexGrow={1} flexShrink={1} flexBasis={0}>
      {children}
    </YStack>
  );
}

SafeArea.displayName = "SafeArea";
