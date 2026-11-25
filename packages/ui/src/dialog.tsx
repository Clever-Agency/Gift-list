import type { ReactNode, RefObject } from "react";
import type { FocusTarget } from "./focus";
import { LayerFrame } from "./layer-frame";

export type DialogProps = {
  open: boolean;
  /** The question or the name of the layer. It is the dialog's accessible name. */
  title: string;
  /** One line under the title, e.g. what happens on confirm. */
  description?: string;
  /**
   * Esc, Android «назад», a scrim press and the close cross: the screen closes the
   * layer by setting `open` to `false`.
   */
  onClose: () => void;
  /**
   * The layer has really left the tree: the screen can put focus back on the control
   * it was opened from (`restoreFocus`). Without it the browser returns focus to the
   * element focused before opening.
   */
  onClosed?: () => void;
  /**
   * Where focus lands on opening: a ref to a control (the destructive confirm lands
   * on «Отмена», so Enter right after opening deletes nothing). Defaults to the title.
   */
  initialFocus?: RefObject<FocusTarget | null>;
  /** `alertdialog` for a destructive confirmation (WAI-ARIA APG). */
  role?: "dialog" | "alertdialog";
  /** A close cross at the end of the title row; the app draws the icon. */
  closeAction?: { label: string; icon: ReactNode };
  /** The body between the title and the actions. */
  children?: ReactNode;
  /** The buttons row, aligned to the end. */
  actions?: ReactNode;
  /**
   * `default` is the confirm width. `detail` is the wish-detail layer: almost the
   * full screen below the `medium` breakpoint, and up to `detail-width` above it.
   * The body scrolls; the title and the close control stay in view.
   */
  layout?: "default" | "detail";
  testID?: string;
};

/**
 * `DESIGN.md` → Dialog: a centered layer up to `dialog-width`, `surface`,
 * `rounded.lg`, over a `scrim` at 40%. Closes with Esc and a scrim press in the
 * browser and with the system «назад» on Android (only while it is open, so with no
 * layer the button works as before). Focus is trapped inside on the web.
 *
 * `DESIGN.md` → Движение: the scrim and the panel fade with `quick` (160 ms) on
 * appearing and leaving, with no shift or scale. With «уменьшить движение» the fade
 * is 100 ms.
 *
 * The paint lives in `layer-frame.tsx` next to the bottom sheet: one layer contract,
 * two presentations that DESIGN keeps apart.
 */
export function Dialog({
  open,
  title,
  description,
  onClose,
  onClosed,
  initialFocus,
  role = "dialog",
  closeAction,
  children,
  actions,
  layout = "default",
  testID,
}: DialogProps) {
  return (
    <LayerFrame
      presentation="dialog"
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      onClosed={onClosed}
      initialFocus={initialFocus}
      role={role}
      closeAction={closeAction}
      actions={actions}
      layout={layout}
      testID={testID}
    >
      {children}
    </LayerFrame>
  );
}

Dialog.displayName = "Dialog";
