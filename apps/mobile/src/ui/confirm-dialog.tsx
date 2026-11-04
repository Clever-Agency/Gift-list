import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { useEffect, useRef, type ComponentRef } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewInstance,
} from "react-native";
import { colors, rounded, spacing, textStyle } from "@/theme/tokens";
import { pageGutter } from "@/ui/card-grid";
import { focusInLayer, useLayerClosed } from "@/ui/focus";
import { PrimaryButton } from "@/ui/primary-button";

/** The `nativeID` of the title, and what `aria-labelledby` on the layer points at. */
const TITLE_ID = "confirm-dialog-title";

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
   * control it was opened from (`useLayerClosed`, `onDismiss`).
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
 * The single dialog of a form (`DESIGN.md` → BottomSheet / Dialog). It has two
 * modes, picked by `variant` (a discriminated union, so the props of one mode
 * cannot leak into the other):
 *
 * - `confirm` (the default) — a destructive confirmation with two actions:
 *   `cancelLabel` + `onCancel` and `confirmLabel` + `onConfirm`, plus an optional
 *   `body`. Initial focus lands on «Отмена», so Enter right after opening does
 *   not delete anything (WAI-ARIA APG alertdialog).
 * - `discard` — «Сохранить изменения?» with three actions: `confirmLabel`
 *   («Сохранить»), `declineLabel` («Не сохранять») and a `closeLabel` cross.
 *   Initial focus lands on the title.
 *
 * `visible={false}` renders nothing; the transparency and fade come from `Modal`.
 * Android «назад» arrives as `onRequestClose`, and react-native-web turns Esc
 * into the same callback; the scrim does the same. In `confirm` mode all of them
 * ask the screen to close via `onCancel`, in `discard` mode via `onClose`.
 *
 * «Занято» is one prop for both modes: `busy`. While it is set the confirmation
 * is disabled and announced busy, and a second press in the same frame is
 * dropped (`answered`), so one opening runs one action.
 *
 * `onClosed` runs once the layer has really gone (`useLayerClosed`), so the
 * screen can put focus back on the control it was opened from — «Удалить
 * желание» or the form's «Отмена». Focus is never moved from an effect on
 * `visible={false}`: on the web that is too early (see `focus.ts`).
 *
 * react-native-web's `Modal` already renders `role="dialog"` and
 * `aria-modal="true"` and forwards the labelling to that element, so the card
 * adds neither of them; on the phone the platform modal is modal on its own.
 */
export function ConfirmDialog(props: ConfirmDialogProps) {
  const { visible, title, busy = false, onClosed } = props;
  const discard = props.variant === "discard";
  const { width: windowWidth } = useWindowDimensions();
  // `DESIGN.md` → dialog: up to `dialog-width`; on a narrow window the page
  // gutter stays visible on both sides.
  const dialogWidth = Math.min(
    spacing["dialog-width"],
    Math.max(0, windowWidth - pageGutter(windowWidth) * 2),
  );
  const titleRef = useRef<ViewInstance>(null);
  const cancelRef = useRef<ComponentRef<typeof Pressable>>(null);
  // One answer per opening. `busy` follows a state update that lands after the
  // handler, so two taps in the same frame would both reach `onConfirm`.
  const answered = useRef(false);
  const handleDismiss = useLayerClosed(visible, onClosed);

  useEffect(
    function resetAnswerOnOpen() {
      // A new opening is a new question: the first press counts again.
      if (visible) answered.current = false;
    },
    [visible],
  );

  useEffect(
    function focusLayerOnOpen() {
      if (!visible) return;
      // `EXPERIENCE.md` → Accessibility Floor «Шторка и диалог»: focus enters the
      // layer as soon as it opens. The destructive confirm lands on the safe
      // «Отмена», the discard step on its title (`tabIndex={-1}` keeps the title
      // out of the tab order while letting the layer focus it).
      focusInLayer(discard ? titleRef.current : cancelRef.current);
    },
    [visible, discard],
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
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={dismiss}
      onDismiss={handleDismiss}
      aria-labelledby={TITLE_ID}
    >
      <View style={styles.overlay}>
        {/* The scrim closes the layer; it is decorative for screen readers —
            the buttons, Esc and Android «назад» do the same. It stays out of the
            Tab order and out of the dialog's initial focus: `tabIndex={-1}` and
            `focusable={false}` keep the pointer handler without making the
            backdrop an interactive stop. */}
        <Pressable
          testID="confirm-dialog-scrim"
          style={styles.scrim}
          onPress={dismiss}
          focusable={false}
          {...{ tabIndex: -1 }}
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <View testID="confirm-dialog-card" style={[styles.dialog, { width: dialogWidth }]}>
          {discard ? (
            <View style={styles.header}>
              <View
                ref={titleRef}
                nativeID={TITLE_ID}
                accessibilityRole="header"
                tabIndex={-1}
                style={styles.titleBox}
              >
                <Text style={styles.title}>{title}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={props.closeLabel}
                onPress={props.onClose}
                style={({ pressed }) => [styles.close, pressed ? styles.pressed : null]}
              >
                <SymbolView
                  name={CLOSE_ICON}
                  size={spacing["icon-nav"]}
                  tintColor={colors.foreground}
                  // Decorative: the button's label is the accessible name.
                  aria-hidden
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                />
              </Pressable>
            </View>
          ) : (
            <>
              <Text accessibilityRole="header" nativeID={TITLE_ID} style={styles.title}>
                {title}
              </Text>
              {props.body ? <Text style={styles.body}>{props.body}</Text> : null}
            </>
          )}
          <View style={styles.actions}>
            {discard ? (
              <>
                {/* «Не сохранять» loses the draft, so it is destructive-red. */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={props.declineLabel}
                  onPress={props.onDecline}
                  style={({ pressed }) => [
                    styles.destructive,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <Text style={styles.destructiveLabel}>{props.declineLabel}</Text>
                </Pressable>
                <PrimaryButton label={props.confirmLabel} onPress={confirm} disabled={busy} />
              </>
            ) : (
              <>
                <Pressable
                  ref={cancelRef}
                  accessibilityRole="button"
                  accessibilityLabel={props.cancelLabel}
                  onPress={props.onCancel}
                  style={({ pressed }) => [styles.cancel, pressed ? styles.pressed : null]}
                >
                  <Text style={styles.cancelLabel}>{props.cancelLabel}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={props.confirmLabel}
                  accessibilityState={{ disabled: busy, busy }}
                  disabled={busy}
                  onPress={confirm}
                  style={({ pressed }) => [
                    styles.destructive,
                    pressed ? styles.pressed : null,
                    busy ? styles.busy : null,
                  ]}
                >
                  <Text style={styles.destructiveLabel}>{props.confirmLabel}</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing["page-gutter-lg"],
  },
  scrim: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.scrim,
    opacity: 0.4,
  },
  dialog: {
    maxWidth: spacing["dialog-width"],
    backgroundColor: colors.surface,
    borderRadius: rounded.lg,
    padding: spacing["card-padding"],
    gap: spacing["grid-gap"],
  },
  /** Title on the left, the close cross on the right (`DESIGN.md` → Dialog). */
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing["grid-gap"] / 2,
  },
  titleBox: {
    flex: 1,
  },
  title: {
    ...textStyle("heading"),
    color: colors.foreground,
  },
  body: {
    ...textStyle("body"),
    color: colors["muted-foreground"],
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: spacing["grid-gap"] / 2,
  },
  // Ghost «Отмена» (`DESIGN.md` → buttons): text only, 44×44.
  cancel: {
    minHeight: spacing["touch-target"],
    minWidth: spacing["touch-target"],
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  cancelLabel: {
    ...textStyle("button"),
    color: colors.primary,
  },
  /** 44×44 touch target around the close icon. */
  close: {
    width: spacing["touch-target"],
    height: spacing["touch-target"],
    alignItems: "center",
    justifyContent: "center",
    borderRadius: rounded.full,
  },
  // Destructive action (`DESIGN.md` → buttons): filled, 44×44 at least.
  destructive: {
    minHeight: spacing["control-height"],
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: rounded.sm,
    backgroundColor: colors.destructive,
  },
  destructiveLabel: {
    ...textStyle("button"),
    color: colors["destructive-foreground"],
  },
  busy: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.9,
  },
});
