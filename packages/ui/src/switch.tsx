import { View } from "@tamagui/core";
import { YStack } from "@tamagui/stacks";
import { useId } from "react";
import { a11yHintProps } from "./a11y-hint";
import { Pressable } from "./pressable";
import { Text } from "./text";

/** `DESIGN.md` → Мелкие элементы: track 52×32, thumb 28. */
const TRACK_WIDTH = 52;
const TRACK_HEIGHT = 32;
const THUMB_SIZE = 28;

export type SwitchProps = {
  /** Visible label and the accessible name of the switch. */
  label: string;
  /** Second line under the label; also the accessible description. */
  hint?: string;
  checked: boolean;
  /** Shows the stored value without letting it change. */
  disabled?: boolean;
  /** The requested next state, so the caller owns the request and its rollback. */
  onChange: (checked: boolean) => void;
  testID?: string;
};

/**
 * Story 3.5: the shared on/off switch of the settings rows (`role="switch"`,
 * `aria-checked`). The whole row is one press surface — the label, the hint and
 * the track — at least `$row-height` tall, so the touch target is never smaller
 * than `44` (`DESIGN.md` → Мелкие элементы). The browser toggles it with Space
 * (and Enter, through `Pressable`); a phone gets the same press through React
 * Native. Colors follow `components.switch`: `$primary` on, `$border-strong`
 * off, a `$surface` thumb.
 */
export function Switch({ label, hint, checked, disabled, onChange, testID }: SwitchProps) {
  const hintId = useId();
  return (
    <Pressable
      role="switch"
      aria-label={label}
      aria-checked={checked}
      {...a11yHintProps({ hint, describedBy: hint ? hintId : undefined })}
      disabled={disabled}
      onPress={function toggle() {
        onChange(!checked);
      }}
      testID={testID}
      flexDirection="row"
      alignItems="center"
      gap="$3"
      minHeight="$row-height"
      paddingVertical="$2"
    >
      <View
        testID="switch-track"
        width={TRACK_WIDTH}
        height={TRACK_HEIGHT}
        borderRadius="$full"
        backgroundColor={checked ? "$primary" : "$border-strong"}
        padding={2}
        flexDirection="row"
        alignItems="center"
        justifyContent={checked ? "flex-end" : "flex-start"}
      >
        <View
          testID="switch-thumb"
          width={THUMB_SIZE}
          height={THUMB_SIZE}
          borderRadius="$full"
          backgroundColor="$surface"
        />
      </View>
      <YStack flex={1} gap="$1">
        <Text kind="body">{label}</Text>
        {hint ? (
          <Text id={hintId} kind="caption" tone="muted">
            {hint}
          </Text>
        ) : null}
      </YStack>
    </Pressable>
  );
}

Switch.displayName = "Switch";
