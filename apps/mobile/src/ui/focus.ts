import { useCallback, useEffect, useRef, type ComponentRef } from "react";
import { AccessibilityInfo, findNodeHandle, Platform, type View } from "react-native";

/** The host node a focusable control resolves to (a DOM element on web). */
export type ChipNode = ComponentRef<typeof View>;

/**
 * `DESIGN.md` → VisibilityChip, → Dialog: after a layer closes, focus goes back to
 * the control it was opened from — the visibility chip, the «Удалить желание»
 * button. The two platforms need different calls: the browser moves DOM focus to
 * the node itself, while React Native has no DOM focus and asks the screen reader
 * to jump to the node's accessibility handle instead.
 */
export function restoreFocus(node: ChipNode | null | undefined): void {
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

/**
 * The `onDismiss` handler a dialog hands to `Modal`: it reports that the layer has
 * really left the tree, so the screen can return focus to the control that opened it.
 *
 * Why not in an effect on `visible`: on the web that is too early, and it is what broke
 * the return after the initial focus moved inside the layer. react-native-web keeps the
 * dialog mounted for the whole fade-out (`ModalAnimation`, 250 ms) and its
 * `ModalFocusTrap` still listens for `focus` during it, so a `focus()` on the trigger is
 * pulled back into the dying dialog and the unmount then drops focus to `<body>`. The
 * trap's own restore cannot save the picker either: the trap remembers the element that
 * was focused when it mounted, and the picker's initial focus runs in a child effect
 * (`ChoiceGroup`), before the trap's own mount effect — so it remembers the radio inside
 * the layer, a node that is gone by the time the trap tears down. `onDismiss` fires
 * after that unmount, which is the only reliable moment.
 *
 * The phone has no DOM focus trap and Android never reports `onDismiss` (React Native
 * implements it for iOS only), so there the `visible` prop itself is the signal.
 */
export function useLayerClosed(visible: boolean, onClosed: () => void): () => void {
  const closed = useRef(onClosed);
  useEffect(() => {
    closed.current = onClosed;
  });

  const wasVisible = useRef(visible);
  useEffect(() => {
    const was = wasVisible.current;
    wasVisible.current = visible;
    if (Platform.OS === "web" || visible || !was) return;
    closed.current();
  }, [visible]);

  return useCallback(() => {
    if (Platform.OS !== "web") return;
    closed.current();
  }, []);
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
