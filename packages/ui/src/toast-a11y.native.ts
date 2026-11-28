import { useEffect, useRef } from "react";
import { AccessibilityInfo, Platform } from "react-native";

/**
 * Accessibility of the toast, phone half.
 *
 * `DESIGN.md` → Доступность → ToastHost asks for two things on a phone:
 *
 * - Android announces the card through `accessibilityLiveRegion`, the native
 *   name of the `aria-live` the web half sets: `polite` for `info` / `success`,
 *   `assertive` for `error` / `warning`;
 * - iOS has no live region for a plain view, so VoiceOver would stay silent
 *   until the person reaches the card. The new text is announced once with
 *   `AccessibilityInfo.announceForAccessibility` instead.
 *
 * The announcement is skipped on Android (the live region already speaks it) and
 * for a text that was already announced while this toast stayed mounted: an
 * unchanged toast is not read again on every render.
 */
export function toastA11yProps(assertive: boolean) {
  return { accessibilityLiveRegion: assertive ? "assertive" : "polite" } as const;
}

/** Announces a new toast text once on iOS. */
export function useToastAnnouncement(message: string) {
  const spoken = useRef<string | null>(null);

  useEffect(
    function announceNewText() {
      if (Platform.OS !== "ios") return;
      if (message === "" || spoken.current === message) return;
      spoken.current = message;
      AccessibilityInfo.announceForAccessibility(message);
    },
    [message],
  );
}
