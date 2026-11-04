import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { colors, rounded, spacing, textStyle } from "@/theme/tokens";
import { pageGutter } from "@/ui/card-grid";

/**
 * `DESIGN.md` → Dialog: a centered layer for a destructive confirmation. The
 * title names the object («Удалить «{title}»?»), the body says what happens, and
 * the destructive confirm sits next to a ghost «Отмена».
 *
 * `visible={false}` renders nothing; the transparency and fade come from
 * `Modal`. Android «назад» arrives as `onRequestClose`, and react-native-web
 * turns Esc into the same callback — the scrim and «Отмена» close it too.
 */
export function ConfirmDialog({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel,
  busy = false,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  body: string;
  /** «Удалить», or «Удаляем…» while the request is in flight. */
  confirmLabel: string;
  cancelLabel: string;
  /** The action is running: the confirm button is disabled and announced as busy. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { width: windowWidth } = useWindowDimensions();
  // `DESIGN.md` → dialog: up to `dialog-width`; on a narrow window the page
  // gutter stays visible on both sides.
  const dialogWidth = Math.min(
    spacing["dialog-width"],
    Math.max(0, windowWidth - pageGutter(windowWidth) * 2),
  );
  const titleId = "confirm-dialog-title";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      // react-native-web's Modal already renders `role="dialog"` and
      // `aria-modal="true"` and forwards the labelling to that element; on the
      // phone the platform modal is modal on its own.
      aria-labelledby={titleId}
    >
      <View style={styles.overlay}>
        {/* The scrim closes the layer; it is decorative for screen readers —
            «Отмена», Esc and Android «назад» do the same. */}
        <Pressable
          style={[StyleSheet.absoluteFill, styles.scrim]}
          onPress={onCancel}
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <View style={[styles.dialog, { width: dialogWidth }]}>
          <Text accessibilityRole="header" nativeID={titleId} style={styles.title}>
            {title}
          </Text>
          <Text style={styles.body}>{body}</Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
              onPress={onCancel}
              style={({ pressed }) => [styles.cancel, pressed ? styles.pressed : null]}
            >
              <Text style={styles.cancelLabel}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              accessibilityState={{ disabled: busy, busy }}
              disabled={busy}
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.confirm,
                pressed ? styles.pressed : null,
                busy ? styles.busy : null,
              ]}
            >
              <Text style={styles.confirmLabel}>{confirmLabel}</Text>
            </Pressable>
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
    paddingVertical: spacing["page-gutter-lg"],
  },
  scrim: {
    backgroundColor: colors.scrim,
    opacity: 0.4,
  },
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: rounded.lg,
    padding: spacing["card-padding"],
    gap: spacing["grid-gap"],
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
    justifyContent: "flex-end",
    alignItems: "center",
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
  // Destructive confirm (`DESIGN.md` → buttons): filled, 44×44 at least.
  confirm: {
    minHeight: spacing["touch-target"],
    minWidth: spacing["touch-target"],
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: rounded.sm,
    backgroundColor: colors.destructive,
  },
  confirmLabel: {
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
