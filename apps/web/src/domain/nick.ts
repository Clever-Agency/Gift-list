import { NICK_PATTERN } from "@gift-list/contracts";

export { NICK_PATTERN };

/** Canonical form used for uniqueness checks and storage in `nickNormalized`. */
export function normalizeNick(nick: string): string {
  return nick.trim().toLowerCase();
}

/** True when `nick` is already normalized and matches AD-13. */
export function isValidNick(nick: string): boolean {
  return NICK_PATTERN.test(nick);
}
