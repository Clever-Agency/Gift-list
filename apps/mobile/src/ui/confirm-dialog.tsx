import { Button, Dialog, colors, spacing, type FocusTarget } from "@gift-list/ui";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { useEffect, useRef } from "react";

/** `DESIGN.md` → BottomSheet / Dialog: the discard step's close cross. */
const CLOSE_ICON = {
  ios: "xmark",
  android: "close",
  web: "close",
} as const satisfies SymbolViewProps["name"];

/** What both modes share: the layer, its question and the report that it has closed. */
type ConfirmDialogBase = {
  visible: boolean;
  /** The question, e.g. «Удалить «{title}»?» or «Сохранить изменения?». Also the layer's name. */
  title: string;
  /**
   * The action is running: the confirmation does not take a second press and is
   * announced as busy. One name for both modes (`confirmDisabled` is gone).
   */
  busy?: boolean;
  /**
   * The layer has really left the tree, so the screen can put focus back on the
   * control it was opened from.
   */
  onClosed: () => void;
};

/**
 * Destructive confirmation (`DESIGN.md` → Dialog): the title names the object, the
 * body says what happens, and the destructive confirm sits next to a ghost «Отмена».
 */
export type DestructiveConfirmDialogProps = ConfirmDialogBase & {
  variant?: "confirm";
  /** «Желание исчезнет из вишлиста. Это нельзя отменить.». */
  body?: string;
  /** «Удалить», or «Удаляем…» while the request is in flight. */
  confirmLabel: string;
  /** «Отмена». */
  cancelLabel: string;
  onConfirm: () => void;
  /** «Отмена», Esc, Android back and a scrim press: the screen closes the layer. */
  onCancel: () => void;
};

/**
 * The step inside the form (`DESIGN.md` → BottomSheet / Dialog: confirm и
 * «Сохранить изменения?» внутри диалога — шаг в том же слое): «Сохранить»,
 * «Не сохранять» and a close cross.
 */
export type DiscardConfirmDialogProps = ConfirmDialogBase & {
  variant: "discard";
  /** «Сохранить». */
  confirmLabel: string;
  /** «Не сохранять»: the draft is given up; destructive red. */
  declineLabel: string;
  /** The accessible name of the close cross, e.g. «Закрыть». */
  closeLabel: string;
  onConfirm: () => void;
  onDecline: () => void;
  /** Cross, Esc, Android back and a scrim press: back to the form, draft kept. */
  onClose: () => void;
};

export type ConfirmDialogProps = DestructiveConfirmDialogProps | DiscardConfirmDialogProps;

/**
 * The single dialog of a form (`DESIGN.md` → BottomSheet / Dialog), built on `Dialog`
 * from `@gift-list/ui`. It has two modes, picked by `variant` (a discriminated union,
 * so the props of one mode cannot leak into the other):
 *
 * - `confirm` (the default) — a destructive confirmation with two actions:
 *   `cancelLabel` + `onCancel` and `confirmLabel` + `onConfirm`, plus an optional
 *   `body`. Initial focus lands on «Отмена», so Enter right after opening does
 *   not delete anything (WAI-ARIA APG alertdialog).
 * - `discard` — «Сохранить изменения?» with three actions: `confirmLabel`
 *   («Сохранить»), `declineLabel` («Не сохранять») and a `closeLabel` cross.
 *   Initial focus lands on the title.
 *
 * `visible={false}` renders nothing. Esc, the scrim and the system «назад» on Android
 * all ask the screen to close via `onCancel` (`confirm`) or `onClose` (`discard`).
 *
 * «Занято» is one prop for both modes: `busy`. While it is set the confirmation
 * is disabled and announced busy, and a second press in the same frame is
 * dropped (`answered`), so one opening runs one action.
 *
 * `onClosed` runs once the layer has really gone, so the screen can put focus back on
 * the control it was opened from — «Удалить желание» or the form's «Отмена».
 */
export function ConfirmDialog(props: ConfirmDialogProps) {
  const { visible, title, busy = false, onClosed } = props;
  const discard = props.variant === "discard";
  const cancelRef = useRef<FocusTarget>(null);
  // One answer per opening. `busy` follows a state update that lands after the
  // handler, so two taps in the same frame would both reach `onConfirm`.
  const answered = useRef(false);

  useEffect(
    function resetAnswerOnOpen() {
      // A new opening is a new question: the first press counts again.
      if (visible) answered.current = false;
    },
    [visible],
  );

  function confirm(): void {
    if (answered.current || busy) return;
    answered.current = true;
    props.onConfirm();
  }

  /** Esc, Android back and the scrim: the screen's own way of closing this mode. */
  function dismiss(): void {
    if (discard) {
      props.onClose();
      return;
    }
    props.onCancel();
  }

  return (
    <Dialog
      open={visible}
      title={title}
      description={discard ? undefined : props.body}
      role={discard ? "dialog" : "alertdialog"}
      onClose={dismiss}
      onClosed={onClosed}
      // The destructive confirm lands on the safe «Отмена»; the discard step on its title.
      initialFocus={discard ? undefined : cancelRef}
      closeAction={
        discard
          ? {
              label: props.closeLabel,
              icon: (
                <SymbolView
                  name={CLOSE_ICON}
                  size={spacing["icon-nav"]}
                  tintColor={colors.foreground}
                  // Decorative: the button's label is the accessible name.
                  aria-hidden
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                />
              ),
            }
          : undefined
      }
      testID="confirm-dialog"
      actions={
        discard ? (
          <>
            {/* «Не сохранять» loses the draft, so it is destructive-red. */}
            <Button label={props.declineLabel} onPress={props.onDecline} variant="destructive" />
            <Button label={props.confirmLabel} onPress={confirm} busy={busy} />
          </>
        ) : (
          <>
            <Button
              ref={cancelRef as never}
              label={props.cancelLabel}
              onPress={props.onCancel}
              variant="ghost"
            />
            <Button
              label={props.confirmLabel}
              onPress={confirm}
              variant="destructive"
              busy={busy}
            />
          </>
        )
      }
    />
  );
}

ConfirmDialog.displayName = "ConfirmDialog";
