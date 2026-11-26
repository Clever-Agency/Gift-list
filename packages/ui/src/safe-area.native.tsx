import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import type { SafeAreaProps } from "./safe-area.types";
import { useTabBarInset } from "./shell-inset";

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
 * screen made by hand. A screen inside the bottom bar drops the bottom edge: the
 * bar holds the inset, so adding it again would fold the home indicator twice
 * (`EXPERIENCE.md` → Навигация). The shell publishes the bar with
 * `useTabBarInset`: it is 0 outside the shell, when there is no bar at all and
 * on expanded screens, and then the frame keeps the bottom edge. `bottom={false}`
 * drops it in every case. The web twin in `safe-area.tsx` keeps `react-native`
 * out of the browser bundle; see it for why the browser needs no insets here.
 */
export function SafeArea({ children, bottom = true }: SafeAreaProps) {
  const tabBarInset = useTabBarInset();
  const holdBottom = bottom && tabBarInset === 0;

  return (
    <SafeAreaView style={fill} edges={holdBottom ? edgesWithBottom : edgesWithoutBottom}>
      {children}
    </SafeAreaView>
  );
}

SafeArea.displayName = "SafeArea";
