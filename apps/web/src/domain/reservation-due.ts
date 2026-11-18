// Story 5.1 (AD-9, ARCH-A14): calendar-day rules for «Подарю до» without Prisma.

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** ISO calendar day (`YYYY-MM-DD`) of an instant in an IANA zone. */
export function calendarDayInZone(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** Add whole calendar days to an ISO day string (UTC arithmetic on the Y-M-D parts). */
export function addCalendarDays(ymd: string, days: number): string {
  const match = ISO_DAY.exec(ymd);
  if (!match) throw new Error("Invalid calendar day");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

/** First instant of `ymd` in `timeZone` (start of that local calendar day). */
export function startOfCalendarDayInZone(ymd: string, timeZone: string): Date {
  const match = ISO_DAY.exec(ymd);
  if (!match) throw new Error("Invalid calendar day");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  let lo = Date.UTC(year, month - 1, day, 0, 0, 0) - 26 * 60 * 60 * 1000;
  let hi = Date.UTC(year, month - 1, day, 0, 0, 0) + 26 * 60 * 60 * 1000;

  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const label = calendarDayInZone(new Date(mid), timeZone);
    if (label < ymd) lo = mid + 1;
    else hi = mid;
  }

  return new Date(lo);
}

/**
 * Exclusive end of the chosen due day: the first instant of the next calendar
 * day in `timeZone`, so the whole selected day counts toward the deadline.
 */
export function reservationDueAtFromDueOn(dueOn: string, timeZone: string): Date {
  return startOfCalendarDayInZone(addCalendarDays(dueOn, 1), timeZone);
}

export function defaultReserveDueOn(timeZone: string, now = new Date()): string {
  return addCalendarDays(calendarDayInZone(now, timeZone), 7);
}

export function maxReserveDueOn(timeZone: string, now = new Date()): string {
  return addCalendarDays(calendarDayInZone(now, timeZone), 30);
}

export function minReserveDueOn(timeZone: string, now = new Date()): string {
  return calendarDayInZone(now, timeZone);
}

/** Whether `dueOn` sits in [today, today+30] in the donor's zone. */
export function isDueOnInRange(dueOn: string, timeZone: string, now = new Date()): boolean {
  if (!ISO_DAY.test(dueOn) || addCalendarDays(dueOn, 0) !== dueOn) return false;
  const min = minReserveDueOn(timeZone, now);
  const max = maxReserveDueOn(timeZone, now);
  return dueOn >= min && dueOn <= max;
}