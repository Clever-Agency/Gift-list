import type { TextStyle } from "react-native";
import { colors, spacing, textStyle } from "@/theme/tokens";

export const navLinkStyle: TextStyle = {
  ...textStyle("button"),
  color: colors.primary,
  minHeight: spacing["touch-target"],
  lineHeight: spacing["touch-target"],
};
