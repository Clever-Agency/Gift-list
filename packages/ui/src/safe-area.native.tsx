import { SafeAreaView } from "react-native-safe-area-context";
import type { SafeAreaProps } from "./safe-area.types";

/** A stable style object, so the frame is not a new object on every render. */
const fill = { flex: 1 };

/**
 * The safe frame of a screen on the phone: `SafeAreaView` with `flex: 1` and the
 * default edges (top, right, bottom, left, all additive) — the exact call every
 * screen made by hand. The web twin in `safe-area.tsx` keeps `react-native` out of
 * the browser bundle; see it for why the browser needs no insets here.
 */
export function SafeArea({ children }: SafeAreaProps) {
  return <SafeAreaView style={fill}>{children}</SafeAreaView>;
}

SafeArea.displayName = "SafeArea";
