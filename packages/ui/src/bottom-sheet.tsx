import type { ReactNode, RefObject } from "react";
import type { FocusTarget } from "./focus";
import { LayerFrame } from "./layer-frame";

export type BottomSheetProps = {
  open: boolean;
  /** The name of the layer; also its visible heading. */
  title: string;
  /** Esc, Android «назад», a scrim press, a drag down and the close cross. */
  onClose: () => void;
  /**
   * The layer has left the tree: the screen can put focus back on the control it was
   * opened from (`restoreFocus`).
   */
  onClosed?: () => void;
  /** Where focus lands on opening. Defaults to the heading. */
  initialFocus?: RefObject<FocusTarget | null>;
  /** A close cross at the end of the heading row; the app draws the icon. */
  closeAction?: { label: string; icon: ReactNode };
  children?: ReactNode;
  /** The buttons row, aligned to the end. */
  actions?: ReactNode;
  testID?: string;
};

/**
 * `DESIGN.md` → BottomSheet: from the bottom, `surface`, `rounded.xl` on top, over a
 * `scrim` at 40%, as high as its content. Closes with Esc and a scrim press in the
 * browser and with the system «назад» on Android (only while open). The browser keeps
 * focus inside the sheet while it is open.
 *
 * `DESIGN.md` → Движение: the sheet rises and the scrim fades with `quick` (160 ms)
 * on both runtimes. With «уменьшить движение» the position jumps (`instant`) and the
 * scrim only fades, for 100 ms.
 *
 * The public API stays as it was; the paint lives in `layer-frame.tsx` next to the
 * centred window, as the sheet presentation of the shared layer contract.
 */
export function BottomSheet({
  open,
  title,
  onClose,
  onClosed,
  initialFocus,
  closeAction,
  children,
  actions,
  testID,
}: BottomSheetProps) {
  return (
    <LayerFrame
      presentation="sheet"
      open={open}
      title={title}
      onClose={onClose}
      onClosed={onClosed}
      initialFocus={initialFocus}
      closeAction={closeAction}
      actions={actions}
      testID={testID}
    >
      {children}
    </LayerFrame>
  );
}

BottomSheet.displayName = "BottomSheet";
