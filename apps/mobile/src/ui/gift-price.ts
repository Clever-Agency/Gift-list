/**
 * Price input of the gift form (Story 2.2, AD-25). The stored amount is integer
 * minor units (two decimals), so the text is parsed part by part: `0.29 * 100`
 * is `28.999999999999996`, `29` from the strings is not.
 */
import { GIFT_PRICE_AMOUNT_MAX } from "@gift-list/contracts";

/**
 * Digits, an optional decimal separator and up to two decimals. A comma is the
 * decimal separator on Russian keyboards, so both `,` and `.` are accepted; a
 * trailing separator (`250.`) is allowed because the user has not finished typing.
 */
const PRICE_TEXT = /^(\d+)(?:[.,](\d{0,2}))?$/;

/**
 * `""` → `null` (no price, AD-25), a valid amount → integer minor units,
 * anything else → `"invalid"`: garbage, a negative number, more than two
 * decimals, or an amount above the contract's `Int` ceiling
 * (`GIFT_PRICE_AMOUNT_MAX`, the same number `giftInputSchema` checks).
 */
export function parsePriceToMinor(text: string): number | null | "invalid" {
  const value = text.trim();
  if (value === "") return null;

  const match = PRICE_TEXT.exec(value);
  if (match === null) return "invalid";

  const [, major = "", fraction = ""] = match;
  // `Number` on a long digit string is inexact, but such an amount is above the
  // ceiling anyway: `Number.isSafeInteger` turns it into `"invalid"` below.
  const minor = Number(major) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(minor) && minor <= GIFT_PRICE_AMOUNT_MAX ? minor : "invalid";
}

/** Prefills the edit form: `25000` → `"250"`, `25050` → `"250.50"`, `25005` → `"250.05"`. */
export function formatMinorToPrice(minor: number): string {
  const major = Math.trunc(minor / 100);
  const fraction = Math.abs(minor % 100);
  return fraction === 0 ? String(major) : `${major}.${String(fraction).padStart(2, "0")}`;
}
