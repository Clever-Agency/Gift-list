import { forwardRef } from "react";
import { Pressable, StyleSheet, Text, type ViewInstance } from "react-native";
import { colors, rounded, spacing, textStyle } from "@/theme/tokens";

export type GhostButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
};

/**
 * Ghost button (`DESIGN.md` → components `button-ghost`, → App → Компоненты):
 * transparent background, `colors.primary` label, `rounded.md`, and a 44×44
 * touch zone built from `minHeight`/`minWidth` plus padding rather than
 * `hitSlop` — on react-native-web it does not enlarge the target for a mouse
 * or a finger.
 *
 * The label stays a prop so the copy lives in the catalogue: «Отмена» is
 * `app.giftForm.action.cancel`.
 *
 * A disabled ghost keeps its place in the focus order: `disabled` is not passed
 * to `Pressable` (it sets `tabIndex={-1}` on the web and drops the control from
 * tabbing), so the state is announced with `accessibilityState.disabled` plus
 * `aria-disabled`, and `onPress` is simply not run.
 *
 * The ref reaches the platform node so a screen can put focus back on «Отмена»
 * after a layer it opened has closed (`DESIGN.md` → Куда уходит фокус).
 */
export const GhostButton = forwardRef<ViewInstance, GhostButtonProps>(function GhostButton(
  { label, onPress, disabled, testID },
  ref,
) {
  const isDisabled = Boolean(disabled);

  function handlePress() {
    if (isDisabled) return;
    onPress();
  }

  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled }}
      aria-disabled={isDisabled}
      testID={testID}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.button,
        pressed && !isDisabled ? styles.pressed : null,
        isDisabled ? styles.disabled : null,
      ]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
});

GhostButton.displayName = "GhostButton";

const styles = StyleSheet.create({
  button: {
    minHeight: spacing["touch-target"],
    minWidth: spacing["touch-target"],
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing["grid-gap"],
    paddingVertical: spacing["grid-gap"] / 2,
    borderRadius: rounded.md,
    backgroundColor: "transparent",
  },
  pressed: {
    backgroundColor: colors.muted,
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    ...textStyle("button"),
    color: colors.primary,
  },
});
