import { AccessibilityInfo, findNodeHandle } from "react-native";
// The explicit native path keeps unit tests on the native branch: Vitest resolves
// a bare "./field-scroll" to the web no-op, while Metro resolves it per platform.
import { scrollFieldIntoView } from "./field-scroll.native";

export type FocusTarget = object;

export function restoreFocus(node: FocusTarget | null | undefined): void {
  moveFocus(node);
}

export function focusInLayer(node: FocusTarget | null | undefined): void {
  moveFocus(node);
}

/**
 * UI5: a form submit moves to the first invalid field. Native ScrollView does
 * not follow DOM focus, so the page is scrolled to the field first — instantly,
 * without animation — and focus goes there only after the scroll. A radio group
 * has no input, so its node gets screen-reader focus instead.
 */
export function focusField(node: FocusTarget | null | undefined): void {
  if (!node) return;
  scrollFieldIntoView(node, function focusAfterScroll() {
    const target = node as { focus?: () => void };
    if (typeof target.focus === "function") {
      target.focus();
      return;
    }
    const handle = findNodeHandle(node as Parameters<typeof findNodeHandle>[0]);
    if (handle != null) AccessibilityInfo.setAccessibilityFocus(handle);
  });
}

function moveFocus(node: FocusTarget | null | undefined): void {
  if (!node) return;
  const handle = findNodeHandle(node as Parameters<typeof findNodeHandle>[0]);
  if (handle != null) AccessibilityInfo.setAccessibilityFocus(handle);
}
