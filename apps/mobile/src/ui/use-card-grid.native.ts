import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cardGrid, type CardGridPlacement } from "@/ui/card-grid";

/** The phone does not measure the column: its window is the content area. */
function ignoreContainer(_element: unknown): void {}

/**
 * W12.23: on Android and iOS the grid is exactly what it was — `cardGrid` on the
 * window width minus the safe-area insets. The native column is the full window minus
 * the gutter, so there is no scrollbar-sized difference between the two, and a
 * measurement would only re-derive the same numbers a frame later.
 *
 * The web sibling `use-card-grid.ts` measures the content area instead. The shape is
 * the same (`{ columns, cardWidth, containerRef }`), so the four screens share one
 * call: on the phone the ref is a no-op and the cards never move.
 */
export function useCardGrid(): CardGridPlacement {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return { ...cardGrid(width, insets), attachContainer: ignoreContainer };
}
