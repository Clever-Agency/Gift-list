import { DateField } from "@gift-list/ui";

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

/**
 * Browser date field of the reserve and extend windows (`DESIGN.md` → Поле
 * даты, D-60): the shared `DateField` with the reservation bounds. The native
 * picker lives in `reserve-date-field.native.tsx`.
 */
export function ReserveDateField({
  dueOn,
  minDue,
  maxDue,
  label,
  caption,
  dateError,
  onChange,
}: ReserveDateFieldProps) {
  return (
    <DateField
      label={label}
      value={dueOn}
      min={minDue}
      max={maxDue}
      hint={caption}
      error={dateError}
      clearable={false}
      onChange={function handleReserveDate(next) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(next)) return;
        onChange(next);
      }}
    />
  );
}

ReserveDateField.displayName = "ReserveDateField";
