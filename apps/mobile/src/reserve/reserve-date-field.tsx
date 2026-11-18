import { Text, YStack } from "@gift-list/ui";

export type ReserveDateFieldProps = {
  dueOn: string;
  minDue: string;
  maxDue: string;
  label: string;
  hint: string;
  caption: string;
  dateError?: string;
  onChange: (dueOn: string) => void;
};

/** Browser date field. The native picker lives in `reserve-date-field.native.tsx`. */
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
  return (
    <YStack gap="$1">
      <Text kind="label">{label}</Text>
      <input
        type="date"
        value={dueOn}
        min={minDue}
        max={maxDue}
        aria-label={hint}
        onChange={function handleWebDate(event) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) return;
          onChange(event.target.value);
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
    </YStack>
  );
}

ReserveDateField.displayName = "ReserveDateField";
