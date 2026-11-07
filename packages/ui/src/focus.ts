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

/**
 * UI5: a form submit moves to the first invalid field. The browser focuses the
 * input and brings it to the middle of the screen with `behavior: "auto"` — the
 * jump is instant on purpose, no smooth scroll and no pulse animation. The phone
 * has no document scrolling here: focusing the input lets the screen ScrollView
 * bring it into view, which `focus.native.ts` relies on.
 */
export function focusField(node: FocusTarget | null | undefined): void {
  const target = node as
    | {
        focus?: () => void;
        scrollIntoView?: (options: {
          block: "center";
          inline: "nearest";
          behavior: "auto";
        }) => void;
      }
    | null
    | undefined;
  target?.focus?.();
  target?.scrollIntoView?.({ block: "center", inline: "nearest", behavior: "auto" });
}

function moveFocus(node: FocusTarget | null | undefined): void {
  // A button or a `tabIndex` element has `focus`; a node without it is skipped.
  (node as { focus?: () => void } | null | undefined)?.focus?.();
}
