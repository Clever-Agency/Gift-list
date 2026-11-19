// `Gift.expiresOn` is a date column; the wire keeps a plain ISO calendar day
// (AD-12). Shared by the owner and the viewer gift-card mappers.

/** ISO calendar day (`YYYY-MM-DD`) of a date column, or `null` when unset. */
export function calendarDay(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export { isCalendarDay } from "@gift-list/contracts";

/** `YYYY-MM-DD` stored as a UTC midnight so `calendarDay` reads the same day back. */
export function calendarDayToDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

/**
 * The calendar day of `now` in an IANA zone. A missing or unknown zone is UTC
 * (Story 2.6: the owner's `User.timeZone` may still be unset).
 */
export function localCalendarDay(now: Date, timeZone: string | null): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: usableTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find(function yearPart(part) {
    return part.type === "year";
  })?.value;
  const month = parts.find(function monthPart(part) {
    return part.type === "month";
  })?.value;
  const day = parts.find(function dayPart(part) {
    return part.type === "day";
  })?.value;
  return `${year}-${month}-${day}`;
}

/** True when `day` is strictly before the owner's local today. Today itself is kept. */
export function isBeforeLocalToday(day: string, now: Date, timeZone: string | null): boolean {
  return day < localCalendarDay(now, timeZone);
}

function usableTimeZone(timeZone: string | null): string {
  if (!timeZone) return "UTC";
  try {
    Intl.DateTimeFormat("en-US", { timeZone }).format(0);
    return timeZone;
  } catch {
    return "UTC";
  }
}
