import { Badge, Bell, IconButton, useThemeColor, View } from "@gift-list/ui";
import { useMedia } from "@tamagui/core";
import { router } from "expo-router";
import { useTranslations } from "use-intl";
import { useNotificationBadge } from "@/navigation/notification-badge";

export function NotificationBellControl({ count, onPress }: { count: number; onPress: () => void }) {
  const t = useTranslations("notifications");
  const label = count ? `${t("title")}. ${t("unread", { count })}` : t("title");
  // The phone has no `currentColor` inheritance, so the glyph takes the plain ink
  // of the button (`ghost` → `foreground`) instead of its black default.
  const iconColor = useThemeColor("foreground");
  return (
    <IconButton label={label} variant="plain" onPress={onPress} testID="notification-bell"
      icon={
        <View width={40} height={40} alignItems="center" justifyContent="center">
          <Bell size={20} color={iconColor} />
          <View position="absolute" top={0} right={0}>
            <Badge count={count} />
          </View>
        </View>
      }
    />
  );
}

NotificationBellControl.displayName = "NotificationBellControl";

export function NotificationBell() {
  const { expanded } = useMedia();
  const count = useNotificationBadge()?.count ?? 0;
  if (expanded) return null;

  function openNotifications() {
    router.navigate("/notifications");
  }

  return <NotificationBellControl count={count} onPress={openNotifications} />;
}

NotificationBell.displayName = "NotificationBell";
