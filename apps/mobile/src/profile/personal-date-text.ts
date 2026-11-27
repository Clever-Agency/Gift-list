import { formatDate } from "@gift-list/contracts";

function twoDigits(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/**
 * A personal date as the `YYYY-MM-DD` value `formatDate()` reads. A date without
 * a year has no calendar value on its own, so 2000 stands in for `Intl`; the year
 * is never displayed then.
 */
export function personalDateValue(date: {
  day: number;
  month: number;
  year: number | null;
}): string {
  return `${String(date.year ?? 2000).padStart(4, "0")}-${twoDigits(date.month)}-${twoDigits(date.day)}`;
}

/** «14.03» without a year, «14.03.2018» with one (Story 7.5, AD-23). */
export function personalDateText(
  date: { day: number; month: number; year: number | null },
  locale: string,
): string {
  return formatDate(personalDateValue(date), locale, { year: date.year !== null });
}
