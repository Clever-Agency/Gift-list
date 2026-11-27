import type { PickerOption } from "@/ui/option-field";

/**
 * The last day a picker may offer for a month when no year is chosen. February
 * stops at 29: a birthday has no year (AD-29) and a personal date may also have
 * none, so 29 February is a real answer there.
 */
export const MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Month names of the interface locale, in calendar order (D-58, AD-29). */
export function monthOptions(locale: string): PickerOption[] {
  const format = new Intl.DateTimeFormat(locale, { month: "long" });
  return Array.from({ length: 12 }, function makeMonth(_, index) {
    return {
      value: String(index + 1),
      label: format.format(new Date(Date.UTC(2000, index, 1))),
    };
  });
}

/**
 * Days of the chosen month: 30 February and 31 April are never offered (AD-29).
 * With a year the leap rule decides February, so 29 February 2023 is not offered
 * and 29 February 2024 is; without a year February stops at 29.
 */
export function dayOptions(
  month: number | null,
  year?: number | null,
): PickerOption[] {
  const last =
    month === null
      ? 31
      : month === 2 && year !== undefined && year !== null && !isLeapYear(year)
        ? 28
        : (MONTH_DAYS[month - 1] ?? 31);
  return Array.from({ length: last }, function makeDay(_, index) {
    return { value: String(index + 1), label: String(index + 1) };
  });
}
