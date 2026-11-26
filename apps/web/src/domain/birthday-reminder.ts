// Story 7.3/7.4 (FR-34, FR-35, AD-23): the calendar rules of the date
// reminders. Rules only: no Prisma, no React/Next.js here (AD-1). The cron
// adapter reads the rows and writes `ReminderLog` + `Notification`.
//
// A reminder goes out once a year, on the recipient's local day exactly
// `N` days before the birthday and from 10:00 local time; the hourly cron
// sends it on the first run that meets both. `ReminderLog` UNIQUE(recipientId,
// subjectId, year, kind) keeps a repeated run to one row (AD-23).

import { localCalendarDay, localHour } from "./calendar-day";
import { addCalendarDays } from "./reservation-due";

/** A Friend's birthday is announced 14 calendar days ahead (Story 7.3, FR-34). */
export const BIRTHDAY_FRIEND_REMINDER_DAYS = 14;

/** The owner's own birthday is announced 30 calendar days ahead (Story 7.4, FR-35). */
export const BIRTHDAY_OWN_REMINDER_DAYS = 30;

/**
 * Local wall-clock hour from which a reminder may go out. A run earlier on the
 * same local day waits for a later one; a run later on that day still sends it.
 */
export const DATE_REMINDER_HOUR = 10;

/** The recipient's own day and hour, read in their IANA zone. */
export type RecipientLocalMoment = {
  /** Local calendar day, `YYYY-MM-DD`. */
  readonly day: string;
  /** Local wall-clock hour, 0–23. */
  readonly hour: number;
};

/**
 * The recipient's local day and hour at `now`. A missing or unknown zone reads
 * as UTC, the same fallback as everywhere else (AD-27, Story 1.8).
 */
export function recipientLocalMoment(now: Date, timeZone: string | null): RecipientLocalMoment {
  return {
    day: localCalendarDay(now, timeZone),
    hour: localHour(now, timeZone),
  };
}

/** Gregorian leap year. */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * The calendar day a birthday falls on in `year` (`YYYY-MM-DD`). 29 February is
 * observed on 28 February in a non-leap year (Story 7.1, AD-23: «29.02 валиден;
 * в невисокосный год для напоминаний считается 28.02»). The year is only the
 * year of the occurrence — the profile stores the day and the month alone.
 */
export function birthdayDayInYear(birthDay: number, birthMonth: number, year: number): string {
  const observedDay =
    birthMonth === 2 && birthDay === 29 && !isLeapYear(year) ? 28 : birthDay;
  return `${year}-${twoDigits(birthMonth)}-${twoDigits(observedDay)}`;
}

/**
 * The birthday year a `daysBefore` reminder on the recipient's local day
 * refers to, or `null` when that local day is not the reminder day.
 *
 * The reminder day is the recipient's local today plus `daysBefore` calendar
 * days (`14` for a Friend, `30` for the owner). Both the current and the next
 * calendar year are tried, so a birthday in early January is matched from
 * December: on 18 December a 1 January birthday is 14 days away and answers
 * `2027`. The returned year is the birthday occurrence the notice is about —
 * that is the `ReminderLog.year`, which keeps December and January apart.
 */
export function birthdayReminderYear(
  birthDay: number,
  birthMonth: number,
  daysBefore: number,
  now: Date,
  timeZone: string | null,
): number | null {
  const target = addCalendarDays(localCalendarDay(now, timeZone), daysBefore);
  const localYear = Number(target.slice(0, 4));

  for (const year of [localYear, localYear + 1]) {
    if (birthdayDayInYear(birthDay, birthMonth, year) === target) return year;
  }
  return null;
}

/**
 * Is the reminder due at `now`? The recipient's local day must be exactly
 * `daysBefore` days before the birthday and their local time at or after
 * 10:00. A day that already passed answers `null`, so the cron never sends a
 * reminder after the fact (Story 7.3: «нет условий в окне → за год не
 * отправляется и не досылается»). A repeated run on the same local day answers
 * the same year, and `ReminderLog` keeps it to one row.
 */
export function dueBirthdayReminderYear(
  birthDay: number,
  birthMonth: number,
  daysBefore: number,
  now: Date,
  timeZone: string | null,
): number | null {
  if (localHour(now, timeZone) < DATE_REMINDER_HOUR) return null;
  return birthdayReminderYear(birthDay, birthMonth, daysBefore, now, timeZone);
}

function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}
