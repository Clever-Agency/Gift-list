import { useTheme } from "@tamagui/core";
import { colors, type ColorToken } from "./tokens";

/**
 * The value of a colour token for a prop that cannot take a theme token: an SVG
 * `stroke`, a native `tintColor`. Inside the provider it is the colour of the active
 * theme (v8: light or dark); outside one — the light palette, which is exactly what
 * such a prop held before the dark theme existed.
 *
 * Everything that lays out a box or colours text takes `$tokens` instead: this hook
 * is only the bridge for the few native/vector props that need a plain string.
 */
export function useThemeColor(name: ColorToken): string {
  const theme = useTheme() as Record<string, string | { val?: string } | undefined>;
  const value = theme[name];
  if (typeof value === "string") return value;
  return value?.val ?? colors[name];
}
