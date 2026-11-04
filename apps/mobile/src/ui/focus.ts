import type { ComponentRef } from "react";
import { AccessibilityInfo, findNodeHandle, Platform, type View } from "react-native";

/** The host node a `VisibilityChip` resolves to (a DOM element on web). */
export type ChipNode = ComponentRef<typeof View>;

/**
 * `DESIGN.md` → VisibilityChip: after the visibility dialog closes, focus goes back
 * to the chip it was opened from. The two platforms need different calls: the browser
 * moves DOM focus to the node itself, while React Native has no DOM focus and asks the
 * screen reader to jump to the node's accessibility handle instead.
 */
export function restoreChipFocus(node: ChipNode | null | undefined): void {
  moveFocus(node);
}

/**
 * `EXPERIENCE.md` → Accessibility Floor «Шторка и диалог»: focus goes inside a layer
 * as soon as it opens. The picker lands on the selected radio and the destructive
 * confirm on «Отмена», so the safe choice is the first stop in the tab order.
 */
export function focusInLayer(node: ChipNode | null | undefined): void {
  moveFocus(node);
}

function moveFocus(node: ChipNode | null | undefined): void {
  if (!node) return;

  if (Platform.OS === "web") {
    // A `Pressable` on react-native-web renders a focusable element; the View fallback
    // has no `focus`, so the optional call keeps both variants safe.
    (node as { focus?: () => void }).focus?.();
    return;
  }

  const handle = findNodeHandle(node);
  if (handle != null) AccessibilityInfo.setAccessibilityFocus(handle);
}
