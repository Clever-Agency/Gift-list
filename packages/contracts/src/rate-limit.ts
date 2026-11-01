/**
 * Fixed-window remainder for `errors.code.RATE_LIMITED`.
 * Under a minute the count is seconds; otherwise whole minutes, rounded up.
 * A later attempt does not lengthen the window — the caller passes the time left in the current one.
 */
export function rateLimitedParams(retryAfterSeconds: number): { unit: "second" | "minute"; count: number } {
  const seconds = Math.max(1, Math.ceil(retryAfterSeconds));
  if (seconds < 60) return { unit: "second", count: seconds };
  return { unit: "minute", count: Math.ceil(seconds / 60) };
}

/** AD-12 error. `message` stays an English diagnostic; the client interpolates `params`. */
export function rateLimitedError(message: string, retryAfterSeconds: number) {
  return {
    ok: false as const,
    code: "RATE_LIMITED" as const,
    message,
    params: rateLimitedParams(retryAfterSeconds),
  };
}
