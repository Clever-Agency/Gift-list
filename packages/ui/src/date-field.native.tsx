import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { YStack } from "@tamagui/stacks";
import { forwardRef, useState } from "react";
import { Platform } from "react-native";
import { BottomSheet } from "./bottom-sheet";
import { Button } from "./button";
import { Pressable } from "./pressable";
import { Text } from "./text";

export type DateFieldProps = {
  label: string;
  /** `YYYY-MM-DD`, or `""` when the owner has not chosen a day. */
  value: string;
  onChange: (value: string) => void;
  /** Inclusive lower bound, `YYYY-MM-DD`. */
  min?: string;
  error?: string;
  hint?: string;
  clearLabel: string;
  /** The button text when no day is chosen. */
  placeholder: string;
  /** Shown on the button when a day is chosen, already formatted. */
  displayValue?: string;
  /** Closes the iOS sheet. */
  doneLabel: string;
  testID?: string;
};

function dayFromDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromDay(day: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, date ?? 1, 12);
}

/**
 * `DESIGN.md` → Поле даты, the phone half: a button that opens the system
 * picker. iOS shows it inline in a sheet; Android uses the system dialog.
 */
export const DateField = forwardRef<unknown, DateFieldProps>(function DateField(
  {
    label,
    value,
    onChange,
    min,
    error,
    hint,
    clearLabel,
    placeholder,
    displayValue,
    doneLabel,
    testID,
  },
  ref,
) {
  const described = error || hint;
  const [open, setOpen] = useState(false);
  const selected = value === "" ? new Date() : dateFromDay(value);

  function openPicker() {
    setOpen(true);
  }

  function closePicker() {
    setOpen(false);
  }

  function clear() {
    onChange("");
  }

  function handleChange(event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === "android") setOpen(false);
    if (event.type === "dismissed" || !date) return;
    onChange(dayFromDate(date));
  }

  const chosen = value === "" ? placeholder : `${label}, ${displayValue ?? value}`;
  const buttonLabel = error ? `${chosen}. ${error}` : chosen;

  const picker = (
    <DateTimePicker
      value={selected}
      mode="date"
      display={Platform.OS === "ios" ? "inline" : "default"}
      minimumDate={min ? dateFromDay(min) : undefined}
      onChange={handleChange}
    />
  );

  return (
    <YStack gap="$1" testID={testID}>
      <Text kind="label">
        {label}
      </Text>
      <Pressable
        ref={ref as never}
        role="button"
        aria-label={buttonLabel}
        accessibilityHint={error ? undefined : hint}
        onPress={openPicker}
        minHeight="$control-height"
        justifyContent="center"
        paddingHorizontal="$3"
        borderWidth={1}
        borderColor={error ? "$destructive" : "$border-strong"}
        borderRadius="$sm"
        backgroundColor="$surface"
      >
        <Text kind="body" tone={value === "" ? "muted" : "default"}>
          {value === "" ? placeholder : (displayValue ?? value)}
        </Text>
      </Pressable>
      {value !== "" ? (
        <Pressable
          role="button"
          aria-label={clearLabel}
          onPress={clear}
          minHeight="$touch-target"
          justifyContent="center"
        >
          <Text kind="button">{clearLabel}</Text>
        </Pressable>
      ) : null}
      {described ? (
        <Text
          kind="caption"
          tone={error ? "destructive" : "muted"}
        >
          {described}
        </Text>
      ) : null}
      {open && Platform.OS === "ios" ? (
        <BottomSheet open title={label} onClose={closePicker}>
          {picker}
          <Button label={doneLabel} onPress={closePicker} />
        </BottomSheet>
      ) : null}
      {open && Platform.OS === "android" ? picker : null}
    </YStack>
  );
});

DateField.displayName = "DateField";
