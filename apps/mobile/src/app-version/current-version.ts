import { APP_VERSION_PATTERN } from "@gift-list/contracts";
import Constants from "expo-constants";

/**
 * CLE-86: the version of this build, read from the Expo config in one place.
 *
 * `app.config.ts` is the single source (`version: "0.1.0"`); `Platform` and the
 * `manifest2` guesses are deliberately not used, because a wrong guess would
 * either block a working build or silently skip the check.
 *
 * Anything unreadable — a missing config, a thrown native module, an empty or
 * malformed string, a `v` prefix, a pre-release suffix — is `null`, and the
 * caller fails open by skipping the request and showing nothing.
 */
export function currentAppVersion(): string | null {
  try {
    const version = Constants.expoConfig?.version;
    if (typeof version !== "string") return null;
    return APP_VERSION_PATTERN.test(version) ? version : null;
  } catch {
    return null;
  }
}
