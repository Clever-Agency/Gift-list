import { styled } from "@tamagui/core";
import { Input as BehaviorInput } from "@tamagui/input";
import { XStack, YStack } from "@tamagui/stacks";
import { forwardRef, useId, type ComponentRef } from "react";
import { focusRing } from "./focus-ring";
import { fontFor } from "./font-style";
import { Pressable } from "./pressable";
import { Text } from "./text";

const DateInput = styled(BehaviorInput, {
  name: "GLDateInput",
  ...fontFor("body"),
  fontSize: "$body",
  lineHeight: "$body",
  color: "$foreground",
  backgroundColor: "$surface",
  borderWidth: 1,
  borderColor: "$border-strong focus:$ring",
  borderRadius: "$sm",
  minHeight: "$control-height",
  paddingHorizontal: "$3",
  // The same 2 px `$ring` with a 2 px offset as every other field and control
  // (`DESIGN.md` → «Кольцо фокуса»); the 1 px border still turns `$ring` too.
  ...focusRing,
  variants: {
    invalid: {
      true: { borderColor: "$destructive focus:$destructive" },
    },
  } as const,
});

export type DateFieldProps = {
  label: string;
  /** `YYYY-MM-DD`, or `""` when the owner has not chosen a day. */
  value: string;
  onChange: (value: string) => void;
  /** Inclusive lower bound, `YYYY-MM-DD`. The browser enforces it. */
  min?: string;
  /** Inclusive upper bound, `YYYY-MM-DD`. The browser enforces it. */
  max?: string;
  error?: string;
  hint?: string;
  /** Shown when a day is set, so the owner can clear an optional date. */
  clearLabel?: string;
  /**
   * `false` hides the clear button of a date that cannot be empty, e.g. a
   * reservation deadline. Defaults to `true`.
   */
  clearable?: boolean;
  /** Phone only: the button text. The browser input has its own empty state. */
  placeholder?: string;
  /** Phone only: the chosen day, already formatted for the button. */
  displayValue?: string;
  /** Phone only: closes the iOS sheet. */
  doneLabel?: string;
  testID?: string;
};

/**
 * `DESIGN.md` → Поле даты, the browser half: a real `<input type="date">`.
 * The phone twin is `date-field.native.tsx`. Copy arrives in props (AD-17).
 */
export const DateField = forwardRef<ComponentRef<typeof DateInput>, DateFieldProps>(
  function DateField(
    { label, value, onChange, min, max, error, hint, clearLabel, clearable, testID },
    ref,
  ) {
    const id = useId();
    const described = error || hint;
    const showClear = clearable !== false && clearLabel !== undefined && value !== "";

    function handleChange(next: string) {
      onChange(next);
    }

    function clear() {
      onChange("");
    }

    return (
      <YStack gap="$1" testID={testID}>
        <Text kind="label" render="label" htmlFor={id}>
          {label}
        </Text>
        <XStack alignItems="center" gap="$2">
          <DateInput
            ref={ref}
            id={id}
            value={value}
            onChangeText={handleChange}
            invalid={Boolean(error)}
            aria-invalid={error ? true : undefined}
            aria-describedby={described ? `${id}-description` : undefined}
            flex={1}
            {...({ type: "date", min, max } as object)}
          />
          {showClear ? (
            <Pressable
              role="button"
              aria-label={clearLabel}
              onPress={clear}
              minHeight="$touch-target"
              minWidth="$touch-target"
              justifyContent="center"
            >
              <Text kind="button">{clearLabel}</Text>
            </Pressable>
          ) : null}
        </XStack>
        {described ? (
          <Text
            id={`${id}-description`}
            kind="caption"
            tone={error ? "destructive" : "muted"}
            // The error is an alert (assertive by itself); only the hint is a
            // polite live region. Both at once contradict each other.
            role={error ? "alert" : undefined}
            aria-live={error ? undefined : "polite"}
          >
            {described}
          </Text>
        ) : null}
      </YStack>
    );
  },
);

DateField.displayName = "DateField";
