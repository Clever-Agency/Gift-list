import { useThemeColor } from "@gift-list/ui";
import { Stack } from "expo-router";
import { NotificationBadgeProvider } from "@/navigation/notification-badge-provider";

/**
 * The signed-in part of the app (Story 6.2): a `Stack` whose first screen is the
 * tabs and whose nested screens — the wish form and details, the settings — open
 * above them, full frame, with the tab bar hidden (`EXPERIENCE.md` → Навигация:
 * вложенные экраны открываются поверх раздела).
 *
 * The anchor keeps `(tabs)` under a nested screen opened from a link, so the
 * system «назад» of `/settings` or `/gifts/:id` returns to the section root
 * instead of leaving the app.
 */
export const unstable_settings = { anchor: "(tabs)" };

export default function AppLayout() {
  const background = useThemeColor("background");

  return (
    <NotificationBadgeProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: background } }} />
    </NotificationBadgeProvider>
  );
}

AppLayout.displayName = "AppLayout";
