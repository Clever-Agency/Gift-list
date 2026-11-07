import { AccessibilityInfo, findNodeHandle } from "react-native";

export type FocusTarget = object;

export function restoreFocus(node: FocusTarget | null | undefined): void {
  moveFocus(node);
}

export function focusInLayer(node: FocusTarget | null | undefined): void {
  moveFocus(node);
}

/**
 * UI5: a form submit moves to the first invalid field. Native has no DOM
 * scrolling: focusing an input opens the keyboard and the screen ScrollView
 * brings it into view. A radio group has no input, so its node gets screen-reader
 * focus instead.
 */
export function focusField(node: FocusTarget | null | undefined): void {
  if (!node) return;
  const target = node as { focus?: () => void };
  if (typeof target.focus === "function") {
    target.focus();
    return;
  }
  const handle = findNodeHandle(node as Parameters<typeof findNodeHandle>[0]);
  if (handle != null) AccessibilityInfo.setAccessibilityFocus(handle);
}

function moveFocus(node: FocusTarget | null | undefined): void {
  if (!node) return;
  const handle = findNodeHandle(node as Parameters<typeof findNodeHandle>[0]);
  if (handle != null) AccessibilityInfo.setAccessibilityFocus(handle);
}
