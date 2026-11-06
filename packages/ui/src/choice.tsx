import { View } from "@tamagui/core";
import { XStack, YStack } from "@tamagui/stacks";
import { createContext, forwardRef, useContext, useId, type ComponentRef, type ReactNode } from "react";
import { Pressable } from "./pressable";
import { Text } from "./text";
import { spacing, typography } from "./tokens";

/** The group error and lock explanation, read with each radio on the phone. */
const ChoiceListHintContext = createContext<string | undefined>(undefined);

/** Joins sentences without doubling the final period of a part. */
function joinSentences(parts: Array<string | undefined>): string | undefined {
  const text = parts.filter((part): part is string => Boolean(part)).join(". ");
  return text ? text.replace(/\.{2,}/g, ".") : undefined;
}

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
  const groupHint = useContext(ChoiceListHintContext);
  const accessibleHint = joinSentences([hint, groupHint]);
  const row = variant === "row";
  return (
    <Pressable
      ref={ref}
      role="radio"
      aria-label={label}
      aria-checked={selected}
      accessibilityHint={accessibleHint}
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
  /** Inline error under the group, e.g. a server rejection. Linked to the group. */
  error?: string;
  /** Persistent explanation under the group, e.g. why the choice is locked. Linked to the group. */
  description?: string;
  children: ReactNode;
};

/** The `radiogroup` around `Choice`s: `rows` stack, `chips` wrap. */
export function ChoiceList({
  label,
  heading,
  variant,
  error,
  description,
  children,
}: ChoiceListProps) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;
  const descriptionId = description ? `${id}-description` : undefined;
  const describedBy = [errorId, descriptionId].filter(Boolean).join(" ");
  const hint = joinSentences([error, description]);
  const Frame = variant === "row" ? YStack : XStack;
  return (
    <YStack gap="$1">
      {heading ? <Text kind="label">{heading}</Text> : null}
      <ChoiceListHintContext.Provider value={hint}>
        <Frame
          role="radiogroup"
          aria-label={label}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          accessibilityHint={hint}
          gap="$2"
          {...(variant === "chip" ? { flexWrap: "wrap" } : null)}
        >
          {children}
        </Frame>
      </ChoiceListHintContext.Provider>
      {error ? (
        <Text id={errorId} kind="caption" tone="destructive" role="alert" aria-live="polite">
          {error}
        </Text>
      ) : null}
      {description ? (
        <Text id={descriptionId} kind="caption" tone="muted" marginTop="$3">
          {description}
        </Text>
      ) : null}
    </YStack>
  );
}

ChoiceList.displayName = "ChoiceList";
