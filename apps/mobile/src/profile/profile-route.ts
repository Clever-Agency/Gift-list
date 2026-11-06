import { NICK_PATTERN, safeNextPath } from "@gift-list/contracts";

/**
 * Story 3.4 / AD-13: a profile nick is exactly one safe path segment.
 *
 * The app receives the nick from the `/u/:nick` route, so it is used twice: as
 * the `api/v1` request segment and as the `next` target after login. Both are
 * built from this one validated value. Nicks are case-insensitive (AD-13), so
 * the value is lowercased before it is checked against `NICK_PATTERN`; the
 * pattern itself already excludes `/`, `?`, `#`, `%` and dot segments, and
 * `safeNextPath` proves the resulting `/u/{nick}` is a plain relative path.
 *
 * Existence is not checked here: the server answers every unknown nick, a
 * former nick after a rename and a Block with the same `not_found`.
 */
export type ProfileRoute = {
  readonly nick: string;
  readonly next: string;
};

export function profileRoute(value: unknown): ProfileRoute | null {
  if (typeof value !== "string") return null;
  const nick = value.trim().toLowerCase();
  if (!NICK_PATTERN.test(nick)) return null;

  const next = `/u/${nick}`;
  if (safeNextPath(next) !== next) return null;

  return { nick, next };
}
