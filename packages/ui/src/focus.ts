/** The node a control resolves to: a DOM element on the web, a native view on the phone. */
export type FocusTarget = object;

/**
 * `DESIGN.md` → «Куда уходит фокус»: after a layer closes, focus goes back to the
 * control it was opened from. The browser moves DOM focus to the node itself; the
 * phone has no DOM focus, so `focus.native.ts` asks the screen reader to jump to
 * the node's accessibility handle.
 */
export function restoreFocus(node: FocusTarget | null | undefined): void {
  moveFocus(node);
}

/**
 * `EXPERIENCE.md` → Accessibility Floor «Шторка и диалог»: focus goes inside a layer
 * as soon as it opens (the destructive confirm lands on «Отмена»).
 */
export function focusInLayer(node: FocusTarget | null | undefined): void {
  moveFocus(node);
}

function moveFocus(node: FocusTarget | null | undefined): void {
  // A button or a `tabIndex` element has `focus`; a node without it is skipped.
  (node as { focus?: () => void } | null | undefined)?.focus?.();
}
