import { View } from "@tamagui/core";
import { XStack, YStack } from "@tamagui/stacks";
import { forwardRef, type ComponentRef, type ReactNode } from "react";
import { Pressable } from "./pressable";
import { Text } from "./text";
import { spacing, typography } from "./tokens";

export type ChoiceProps = {
  /** `rows`: radio dot, label and a hint line. `chip`: a compact label, e.g. a currency code. */
  variant: "row" | "chip";
  /** Visible text and the accessible name of the radio. */
  label: string;
  /** Second line under the label on a row; also the accessible description. */
  hint?: string;
  selected: boolean;
  /** Shows the stored value without letting it change. */
  disabled?: boolean;
  onPress: () => void;
  testID?: string;
};

/**
 * One option of a `ChoiceList` (`role="radio"`, `aria-checked`). The ref reaches the
 * node, so a layer can put focus on the selected option when it opens.
 */
export const Choice = forwardRef<ComponentRef<typeof Pressable>, ChoiceProps>(function Choice(
  { variant, label, hint, selected, disabled, onPress, testID },
  ref,
) {
  const row = variant === "row";
  return (
    <Pressable
      ref={ref}
      role="radio"
      aria-label={label}
      aria-checked={selected}
      accessibilityHint={hint}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      minHeight="$touch-target"
      minWidth={row ? undefined : "$touch-target"}
      borderWidth={1}
      borderRadius="$sm"
      paddingHorizontal="$3"
      {...(row
        ? {
            flexDirection: "row",
            alignItems: "flex-start",
            gap: "$2",
            paddingVertical: "$2",
            backgroundColor: selected ? "$muted" : "$surface",
            borderColor: selected ? "$primary" : "$border-strong",
          }
        : {
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: selected ? "$primary" : "$surface",
            borderColor: selected ? "$primary" : "$border-strong",
          })}
      {...(disabled ? { opacity: 0.6 } : null)}
    >
      {row ? (
        <>
          <View
            width={spacing["icon-inline"]}
            height={spacing["icon-inline"]}
            marginTop={(typography.body.lineHeight - spacing["icon-inline"]) / 2}
            borderRadius="$full"
            borderWidth={2}
            borderColor={selected ? "$primary" : "$border-strong"}
            alignItems="center"
            justifyContent="center"
          >
            {selected ? <View width={spacing["icon-inline"] / 2} height={spacing["icon-inline"] / 2} borderRadius="$full" backgroundColor="$primary" /> : null}
          </View>
          <YStack flex={1} gap="$1">
            <Text kind="label" tone={selected ? "primary" : "default"}>
              {label}
            </Text>
            {hint ? (
              <Text kind="caption" tone="muted">
                {hint}
              </Text>
            ) : null}
          </YStack>
        </>
      ) : (
        <Text kind="label" tone={selected ? "inverse" : "default"}>
          {label}
        </Text>
      )}
    </Pressable>
  );
});

Choice.displayName = "Choice";

export type ChoiceListProps = {
  /** The accessible name of the group. */
  label: string;
  /** The visible heading of the group. Omit when the surrounding layer has its own. */
  heading?: string;
  variant: "row" | "chip";
  /** Inline error under the group, e.g. a server rejection. */
  error?: string;
  children: ReactNode;
};

/** The `radiogroup` around `Choice`s: `rows` stack, `chips` wrap. */
export function ChoiceList({ label, heading, variant, error, children }: ChoiceListProps) {
  const Frame = variant === "row" ? YStack : XStack;
  return (
    <YStack gap="$1">
      {heading ? <Text kind="label">{heading}</Text> : null}
      <Frame role="radiogroup" aria-label={label} gap="$2" {...(variant === "chip" ? { flexWrap: "wrap" } : null)}>
        {children}
      </Frame>
      {error ? (
        <Text kind="caption" tone="destructive" aria-live="polite">
          {error}
        </Text>
      ) : null}
    </YStack>
  );
}

ChoiceList.displayName = "ChoiceList";
