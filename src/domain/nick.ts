// Nick rules (AD-13 / UX-A6): 3–24 chars of [a-z0-9_], unique case-insensitively.
export const NICK_PATTERN = /^[a-z0-9_]{3,24}$/;

export const NICK_RULES_TEXT =
  "От 3 до 24 символов: строчные латинские буквы, цифры и «_»";

/** Canonical form used for uniqueness checks and storage in `nickNormalized`. */
export function normalizeNick(nick: string): string {
  return nick.trim().toLowerCase();
}

export function isValidNick(nick: string): boolean {
  return NICK_PATTERN.test(nick);
}
