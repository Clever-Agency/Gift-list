import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslations } from "use-intl";
import { colors, rounded, spacing, textStyle } from "@/theme/tokens";

/**
 * One toast at a time (`DESIGN.md` → Toast, ToastHost). An error is announced
 * assertively and stays until it is dismissed: «Нет сети» never hides itself.
 * NOTE FOR UX: auto-dismiss timing, pause on focus and the undo action arrive with
 * the flows that need them (Stories 2.3 and 5.3).
 */
export function ToastHost({
  message,
  tone = "error",
  onDismiss,
}: {
  message: string;
  tone?: "info" | "error";
  onDismiss: () => void;
}) {
  const t = useTranslations("app.toast");
  const palette = tone === "error" ? styles.error : styles.info;

  return (
    <View style={styles.host}>
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
        style={[styles.toast, palette]}
      >
        <Text style={[styles.message, tone === "error" ? styles.errorText : styles.infoText]}>
          {message}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onDismiss}
          style={({ pressed }) => [styles.dismiss, pressed ? styles.pressed : null]}
        >
          <Text style={styles.dismissLabel}>{t("close")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: spacing["page-gutter"],
    right: spacing["page-gutter"],
    bottom: spacing["grid-gap"],
    alignItems: "center",
    pointerEvents: "box-none",
  },
  toast: {
    width: "100%",
    maxWidth: spacing["dialog-width"],
    minHeight: spacing["control-height"],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing["grid-gap"] / 2,
    borderRadius: rounded.md,
    paddingHorizontal: spacing["card-padding"],
    paddingVertical: spacing["grid-gap"] / 2,
  },
  info: {
    backgroundColor: colors.foreground,
  },
  error: {
    backgroundColor: colors.destructive,
  },
  message: {
    flexShrink: 1,
    ...textStyle("label"),
  },
  errorText: {
    color: colors["destructive-foreground"],
  },
  infoText: {
    color: colors["primary-foreground"],
  },
  dismiss: {
    minHeight: spacing["touch-target"],
    minWidth: spacing["touch-target"],
    justifyContent: "center",
    alignItems: "center",
  },
  pressed: {
    opacity: 0.9,
  },
  dismissLabel: {
    ...textStyle("button"),
    color: colors.background,
    textDecorationLine: "underline",
  },
});
