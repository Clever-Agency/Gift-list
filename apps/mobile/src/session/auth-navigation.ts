/**
 * The email typed on one anonymous screen, handed to the next one without putting it
 * in the URL. Memory only: a reload, a deep link or a return without state starts empty.
 *
 * A hand-off names its target, so only that screen can take it, and expires quickly:
 * a modified click that opens a new tab leaves nothing for a later visitor to pick up.
 */
export type AuthScreen = "/login" | "/register" | "/forgot";

export const AUTH_EMAIL_CARRY_TTL_MS = 60_000;

type CarriedEmail = {
  target: AuthScreen;
  email: string;
  expiresAt: number;
};

let carried: CarriedEmail | null = null;

export function rememberAuthEmail(target: AuthScreen, value: string): void {
  const email = value.trim();
  carried =
    email.length > 0
      ? { target, email, expiresAt: Date.now() + AUTH_EMAIL_CARRY_TTL_MS }
      : null;
}

/** Reads the email addressed to `target` once. A different target leaves it untouched. */
export function consumeAuthEmail(target: AuthScreen): string {
  if (carried === null) return "";
  const now = Date.now();
  if (carried.expiresAt <= now) {
    carried = null;
    return "";
  }
  if (carried.target !== target) return "";
  const email = carried.email;
  carried = null;
  return email;
}

/** Drops any pending hand-off, for example between tests or on an explicit reset. */
export function forgetAuthEmail(): void {
  carried = null;
}
