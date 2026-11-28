import { Button, Text, YStack } from "@gift-list/ui";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";
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
  hint,
  caption,
  dateError,
  onChange,
}: ReserveDateFieldProps) {
  const [showPicker, setShowPicker] = useState(false);
  // The error under the date is a plain line for the browser; the phone has no
  // live region around it, so a new sentence is spoken once (`gift-form.tsx` does
  // the same with its first submit error).
  const announcedError = useRef<string | null>(null);
  useEffect(
    function announceDateError() {
      if (!dateError) {
        announcedError.current = null;
        return;
      }
      if (announcedError.current === dateError) return;
      announcedError.current = dateError;
      AccessibilityInfo.announceForAccessibility(dateError);
    },
    [dateError],
  );

  return (
    <YStack gap="$1">
      <Button
        label={label}
        hint={hint}
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
