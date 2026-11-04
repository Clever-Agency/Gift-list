// `Gift.expiresOn` is a date column; the wire keeps a plain ISO calendar day
// (AD-12). Shared by the owner and the viewer gift-card mappers.

/** ISO calendar day (`YYYY-MM-DD`) of a date column, or `null` when unset. */
export function calendarDay(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}
