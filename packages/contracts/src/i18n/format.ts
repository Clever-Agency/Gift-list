/**
 * AD-25 / AD-27. Same closed set as `CURRENCIES` in the package entry.
 * Duplicated here so formatting does not import the entry (that re-exports this module).
 */
const PRICE_CURRENCIES = ["USD", "EUR", "CNY", "BYN", "RUB"] as const;

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** NFC, lower case, `ё → е`. `й` stays `й`. */
export function normalizeForSearch(value: string): string {
  return value.normalize("NFC").toLocaleLowerCase("ru").replaceAll("ё", "е");
}

/**
 * `amountMinor` is integer minor units (two decimals, AD-25).
 * A currency outside USD|EUR|CNY|BYN|RUB throws; the message is not a UI string.
 */
export function formatPrice(amountMinor: number, currency: string, locale: string): string {
  if (!(PRICE_CURRENCIES as readonly string[]).includes(currency)) {
    throw new Error(`Unsupported currency: ${currency}`);
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: currency === "RUB" ? "narrowSymbol" : "code",
  }).format(amountMinor / 100);
}

/**
 * Date-only values (`YYYY-MM-DD`) format in UTC so the calendar day does not shift.
 * Instants use `options.timeZone`, or UTC when it is omitted.
 *
 * Story 5.5: `options.year: false` yields the short `DD.MM` a reservation card
 * shows («до DD.MM»); the year stays on by default, so every older call keeps the
 * full date. One function formats every date, so no screen invents its own.
 */
export function formatDate(
  value: string,
  locale: string,
  options?: { timeZone?: string; year?: boolean },
): string {
  const dateOnly = DATE_ONLY.test(value);
  const date = new Date(dateOnly ? `${value}T00:00:00.000Z` : value);
  const timeZone = dateOnly ? "UTC" : (options?.timeZone ?? "UTC");
  const format: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    timeZone,
  };
  if (options?.year !== false) format.year = "numeric";
  return new Intl.DateTimeFormat(locale, format).format(date);
}

/**
 * CLE-124/S9c: the one day-of-the-month in words («3 декабря», «December 3»).
 * `Intl` picks the order for the locale, so no screen or letter builds a date
 * from month names or `getDate()`/`getMonth()`.
 *
 * A date-only `YYYY-MM-DD` is a calendar day and formats in UTC, so the day does
 * not shift. An instant (a `Date` or an ISO string with time) formats in
 * `timeZone` — the recipient's zone — or in UTC when it is omitted.
 */
export function formatDay(value: string | Date, locale: string, timeZone?: string): string {
  const dateOnly = typeof value === "string" && DATE_ONLY.test(value);
  const date = typeof value === "string"
    ? new Date(dateOnly ? `${value}T00:00:00.000Z` : value)
    : value;
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    timeZone: dateOnly ? "UTC" : (timeZone ?? "UTC"),
  }).format(date);
}

/** `Intl.Collator` for ordering only. Search must use {@link normalizeForSearch}. */
export function compareForSort(locale: string, left: string, right: string): number {
  return new Intl.Collator(locale).compare(left, right);
}
