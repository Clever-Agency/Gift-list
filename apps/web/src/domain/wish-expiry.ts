// Story 6.6 (FR-42, D-26, D-49): the holder's «срок желания скоро» rule.
// Rules only: no Prisma, no React/Next.js here (AD-1). The cron and the
// notification write live in their adapters.

import { localCalendarDay, localHour } from "./calendar-day";
import { addCalendarDays } from "./reservation-due";

/** The `WISH_EXPIRY_SOON` notice lands three calendar days before `expiresOn`. */
export const WISH_EXPIRY_SOON_DAYS = 3;

/**
 * Local wall-clock hour from which the notice may go out. A run earlier on the
 * same day waits for a later one; a run later on the same day still sends it.
 */
export const WISH_EXPIRY_SOON_HOUR = 10;

/** The local day of the «скоро» notice: `expiresOn − 3`, across month and year ends. */
export function wishExpirySoonDay(expiresOnDay: string): string {
  return addCalendarDays(expiresOnDay, -WISH_EXPIRY_SOON_DAYS);
}

/**
 * Is `now` the moment of the holder's «срок желания через 3 дня» notice?
 *
 * The rule is the holder's local calendar day (their `User.timeZone`, UTC when
 * unset or unknown) equal to `expiresOn − 3` and their local time at or after
 * 10:00. A day that already passed answers `false`, so a reservation made after
 * that day never gets the notice late: the cron does not send it after the fact.
 * A repeated run on the same day answers `true`, and the notification key keeps
 * it to one row (Story 6.6).
 */
export function isWishExpirySoon(
  expiresOnDay: string,
  now: Date,
  timeZone: string | null,
): boolean {
  return (
    localCalendarDay(now, timeZone) === wishExpirySoonDay(expiresOnDay) &&
    localHour(now, timeZone) >= WISH_EXPIRY_SOON_HOUR
  );
}
