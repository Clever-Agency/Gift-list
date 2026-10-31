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
 */
export function formatDate(
  value: string,
  locale: string,
  options?: { timeZone?: string },
): string {
  const dateOnly = DATE_ONLY.test(value);
  const date = new Date(dateOnly ? `${value}T00:00:00.000Z` : value);
  const timeZone = dateOnly ? "UTC" : (options?.timeZone ?? "UTC");
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone,
  }).format(date);
}

/** `Intl.Collator` for ordering only. Search must use {@link normalizeForSearch}. */
export function compareForSort(locale: string, left: string, right: string): number {
  return new Intl.Collator(locale).compare(left, right);
}
