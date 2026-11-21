import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import type { SafeAreaProps } from "./safe-area.types";

/**
 * A stable style object, so the frame is not a new object on every render. The
 * edges are stable too: the tab screens share one list without the bottom inset.
 */
const fill = { flex: 1 };
const edgesWithBottom: readonly Edge[] = ["top", "right", "bottom", "left"];
const edgesWithoutBottom: readonly Edge[] = ["top", "right", "left"];

/**
 * The safe frame of a screen on the phone: `SafeAreaView` with `flex: 1` and the
 * default edges (top, right, bottom, left, all additive) — the exact call every
 * screen made by hand. A screen inside the tab bar passes `bottom={false}`: the
 * bar holds the bottom inset, so the frame takes the other three edges only. The
 * web twin in `safe-area.tsx` keeps `react-native` out of the browser bundle; see
 * it for why the browser needs no insets here.
 */
export function SafeArea({ children, bottom = true }: SafeAreaProps) {
  return (
    <SafeAreaView style={fill} edges={bottom ? edgesWithBottom : edgesWithoutBottom}>
      {children}
    </SafeAreaView>
  );
}

SafeArea.displayName = "SafeArea";
