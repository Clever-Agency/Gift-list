import { typography, type TypographyRole } from "./tokens";

/** Phone side of `fontFor`: the weight is chosen by `face` of `$body` / `$heading`. */
export function fontFor(role: TypographyRole) {
  const family = typography[role].fontFamily === "Lora" ? "$heading" : "$body";
  return { fontFamily: family, fontWeight: `$${role}` } as const;
}
