import { typography, type TypographyRole } from "./tokens";

/**
 * Web side of the font choice for a typography role (`DESIGN.md` → Typography).
 * Each weight of Manrope is its own font (`$body-500`, `$body-600`; see
 * `createGiftListConfig`), so Expo web gets the loaded file of that weight and Next
 * the real weight of one family. Lora roles use `display`. The family is spelled
 * without `$`: only then Tamagui puts the `font_<name>` class on the element, which
 * is what switches `--f-family` to that font (a `$name` leaves it on the root font). The phone keeps the
 * `face` mechanism of `$body` (`font-style.native.ts`).
 */
export function fontFor(role: TypographyRole) {
  const { fontFamily, fontWeight } = typography[role];
  const family =
    fontFamily === "Lora" ? "display" : fontWeight === "400" ? "body" : `body-${fontWeight}`;
  return { fontFamily: family, fontWeight: `$${role}` } as const;
}
