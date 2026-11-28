/** One key of the browser that remembers the closed hint (UX-DR11). */
export const INSTALL_HINT_DISMISSED_KEY = "gift-list:install-hint-dismissed";

type InstallHintListener = () => void;

/** Every mounted hint listens here, so closing one closes the others too. */
const listeners = new Set<InstallHintListener>();

/**
 * Subscribes a mounted hint to the closed marker. A `storage` event does not fire
 * in the tab that wrote the value, so the module tells the other mounted screens
 * itself: switching tabs after the cross must not restore the hint.
 */
export function subscribeInstallHint(listener: InstallHintListener): () => void {
  listeners.add(listener);
  return function unsubscribe() {
    listeners.delete(listener);
  };
}

/**
 * The hint is shown once per browser: a closed hint writes a marker to the local
 * storage of the page. A blocked or missing storage (a private window, a server
 * render) only means the choice is not remembered; the screen still renders.
 */
export function isInstallHintDismissed(): boolean {
  try {
    return globalThis.localStorage?.getItem(INSTALL_HINT_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Remembers the closed hint; a refused write is not an error for the screen. */
export function dismissInstallHint(): void {
  try {
    globalThis.localStorage?.setItem(INSTALL_HINT_DISMISSED_KEY, "1");
  } catch {
    // The hint stays closed for this mount; a later visit may show it again.
  }
  for (const listener of Array.from(listeners)) listener();
}
