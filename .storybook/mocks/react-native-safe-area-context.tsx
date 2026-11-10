import type { ReactNode } from "react";
import { View, useWindowDimensions } from "react-native";

/**
 * The insets come from the native window; a catalog has none. The page keeps its
 * own layout (gutter, columns) and only loses the notch padding, which is what a
 * desktop browser shows of the same screens anyway.
 */

export function SafeAreaProvider({ children }: { children?: ReactNode }) {
  return children ?? null;
}

export function SafeAreaView({
  children,
  style,
  ...rest
}: {
  children?: ReactNode;
  style?: unknown;
  [key: string]: unknown;
}) {
  return (
    <View {...rest} style={[{ flex: 1 }, style]}>
      {children}
    </View>
  );
}

export function useSafeAreaInsets() {
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

export function useSafeAreaFrame() {
  const { width, height } = useWindowDimensions();
  return { x: 0, y: 0, width, height };
}

export const initialWindowMetrics = null;

export const SafeAreaInsetsContext = null;
export const SafeAreaFrameContext = null;
export const SafeAreaProviderCompat = SafeAreaProvider;
