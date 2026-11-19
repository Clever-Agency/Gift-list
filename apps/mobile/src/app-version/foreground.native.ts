import { AppState, type AppStateStatus } from "react-native";

/**
 * CLE-86: calls `onActive` exactly once per return to the foreground.
 *
 * iOS also reports `inactive` for the app switcher and notification shade, so
 * only a real `active` after a non-active state counts: opening the switcher
 * and coming back triggers one recheck, not two. `AppState.currentState` is the
 * starting point, so a subscription made while the app is already active does
 * not fire immediately (the mount check does the first request).
 *
 * Returns the unsubscribe function the gate runs on unmount.
 */
export function subscribeForeground(onActive: () => void): () => void {
  // `currentState` is `string | null | undefined` until the first value arrives;
  // anything other than `active` counts as "not in the foreground yet".
  let previous: string | null = AppState.currentState ?? null;

  const subscription = AppState.addEventListener(
    "change",
    function handleAppStateChange(next: AppStateStatus) {
      const becameActive = next === "active" && previous !== "active";
      previous = next;
      if (becameActive) onActive();
    },
  );

  return function unsubscribeFromForeground() {
    subscription.remove();
  };
}
