import { getCalendars } from "expo-localization";
import { Platform } from "react-native";

/** IANA zone: `Intl` in the browser, `expo-localization` on Android and iOS (Story 1.8). */
export function deviceTimeZone(): string | null {
  if (Platform.OS === "web") {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof zone === "string" && zone.length > 0 ? zone : null;
  }
  const zone = getCalendars()[0]?.timeZone;
  return typeof zone === "string" && zone.length > 0 ? zone : null;
}
