/**
 * CLE-86 web/test stand-in for the foreground recheck.
 *
 * Only the native app can come back to the foreground; the web build does not
 * check versions at all, so the subscription is a no-op that still returns a
 * working unsubscribe function (the gate's effect cleanup does not branch).
 */
export function subscribeForeground(_onActive: () => void): () => void {
  return function unsubscribeFromForeground() {};
}
