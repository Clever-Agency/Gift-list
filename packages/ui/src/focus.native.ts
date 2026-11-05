import { AccessibilityInfo, findNodeHandle } from "react-native";

export type FocusTarget = object;

export function restoreFocus(node: FocusTarget | null | undefined): void {
  moveFocus(node);
}

export function focusInLayer(node: FocusTarget | null | undefined): void {
  moveFocus(node);
}

function moveFocus(node: FocusTarget | null | undefined): void {
  if (!node) return;
  const handle = findNodeHandle(node as Parameters<typeof findNodeHandle>[0]);
  if (handle != null) AccessibilityInfo.setAccessibilityFocus(handle);
}
