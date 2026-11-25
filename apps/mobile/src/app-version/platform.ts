import { APP_PLATFORMS, type AppPlatform } from "@gift-list/contracts";
import { Platform } from "react-native";

/**
 * CLE-86: the policy branch of this build, or `null` outside Android and iOS.
 *
 * Only the two store platforms can be updated through a store link; the web
 * build refreshes with a page reload and never checks a version. `null` means
 * "do not request, do not show anything".
 */
export function appVersionPlatform(): AppPlatform | null {
  const os = Platform.OS;
  const known = APP_PLATFORMS.some(function matches(value) {
    return value === os;
  });
  return known ? (os as AppPlatform) : null;
}
