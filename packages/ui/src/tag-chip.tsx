import { XStack } from "@tamagui/stacks";
import { Pressable } from "./pressable";
import { Text } from "./text";

export type TagChipProps = {
  /** Visible text and the accessible name of the toggle or the chip. */
  label: string;
  /** A fixed tag is a checkbox: selected chips unfill and show a check. */
  selected?: boolean;
  /** Toggles the fixed tag. Ignored when `onRemove` is set. */
  onPress?: () => void;
  /**
   * The accessible name of the cross, e.g. «Убрать тег мечта». A chip with a
   * cross is a removable custom tag: its label is text, not a checkbox.
   */
  removeLabel?: string;
  onRemove?: () => void;
  testID?: string;
};

/**
 * Tag picker chip (`DESIGN.md` → Tag picker, `components.tag-chip`). A fixed
 * tag is a `checkbox` with its own state; a custom tag is a chip with a cross
 * that removes it. Both keep the 44 px touch target and take their copy from
 * the caller: fixed labels come from the server catalogue, never from here.
 */
export function TagChip({
  label,
  selected = false,
  onPress,
  removeLabel,
  onRemove,
  testID,
}: TagChipProps) {
  if (onRemove) {
    return (
      <XStack
        testID={testID}
        role="group"
        aria-label={label}
        alignItems="center"
        gap="$1"
        borderWidth={1}
        borderColor="$border"
        borderRadius="$sm"
        backgroundColor="$background"
        paddingLeft="$2"
      >
        <Text kind="caption" tone="muted">
          {label}
        </Text>
        <Pressable
          role="button"
          aria-label={removeLabel ?? label}
          onPress={onRemove}
          minHeight="$touch-target"
          minWidth="$touch-target"
          alignItems="center"
          justifyContent="center"
        >
          <Text kind="caption" tone="muted" aria-hidden>
            ×
          </Text>
        </Pressable>
      </XStack>
    );
  }

  return (
    <Pressable
      testID={testID}
      role="checkbox"
      aria-label={label}
      aria-checked={selected}
      onPress={onPress}
      minHeight="$touch-target"
      minWidth="$touch-target"
      flexDirection="row"
      alignItems="center"
      gap="$1"
      borderWidth={1}
      borderColor={selected ? "$border-strong" : "$border"}
      borderRadius="$sm"
      backgroundColor={selected ? "$muted" : "$background"}
      paddingHorizontal="$2"
    >
      <Text kind="caption" tone={selected ? "default" : "muted"}>
        {label}
      </Text>
      {selected ? (
        <Text kind="caption" tone="muted" aria-hidden>
          ✓
        </Text>
      ) : null}
    </Pressable>
  );
}

TagChip.displayName = "TagChip";
