import { createContext, useContext } from "react";

type BadgeValue = { count: number; refresh: () => void };

export const NotificationBadgeContext = createContext<BadgeValue | null>(null);

export function useNotificationBadge() {
  return useContext(NotificationBadgeContext);
}
