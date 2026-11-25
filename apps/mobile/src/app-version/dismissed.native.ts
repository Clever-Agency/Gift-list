import * as SecureStore from "expo-secure-store";

/**
 * CLE-86: the last `latestVersion` whose soft offer was closed on this phone.
 *
 * Only the version string is stored: no user, session or platform data, so the
 * key is not personal. A new `latestVersion` is a new reason to ask, while the
 * blocking screen ignores this record entirely.
 */
export const DISMISSED_APP_VERSION_KEY = "gift-list.app-version.dismissed";

/**
 * A failed read is not a reason to hide the offer: the caller treats `null` as
 * "nothing was closed yet", which at worst repeats one dialog. Errors are
 * swallowed here so a broken store never breaks the launch.
 */
export async function readDismissedVersion(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(DISMISSED_APP_VERSION_KEY);
  } catch {
    return null;
  }
}

/**
 * A failed write only means the offer returns after the next launch; the dialog
 * still closes right away, so the error is swallowed.
 */
export async function writeDismissedVersion(version: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(DISMISSED_APP_VERSION_KEY, version);
  } catch {
    // Nothing to recover: the next launch simply offers the update again.
  }
}
