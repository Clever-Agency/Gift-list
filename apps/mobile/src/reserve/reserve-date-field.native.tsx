import { Button, Text, YStack } from "@gift-list/ui";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Platform } from "react-native";
import type { ReserveDateFieldProps } from "@/reserve/reserve-date-field";

function ymdToDate(ymd: string): Date {
  return new Date(`${ymd}T12:00:00.000Z`);
}

function dateToYmd(value: Date): string {
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}`;
}

/** System date picker (DESIGN: phone). Metro loads this file instead of the web field. */
export function ReserveDateField({
  dueOn,
  minDue,
  maxDue,
  label,
  caption,
  dateError,
  onChange,
}: ReserveDateFieldProps) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <YStack gap="$1">
      <Button
        label={label}
        variant="ghost"
        onPress={function openPicker() {
          setShowPicker(true);
        }}
      />
      <Text kind="caption" tone="muted">
        {caption}
      </Text>
      {dateError ? (
        <Text kind="caption" tone="destructive">
          {dateError}
        </Text>
      ) : null}
      {showPicker ? (
        <DateTimePicker
          value={ymdToDate(dueOn)}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          minimumDate={ymdToDate(minDue)}
          maximumDate={ymdToDate(maxDue)}
          onChange={function handleNativeDate(_event, value) {
            setShowPicker(false);
            if (value) onChange(dateToYmd(value));
          }}
        />
      ) : null}
    </YStack>
  );
}

ReserveDateField.displayName = "ReserveDateField";
