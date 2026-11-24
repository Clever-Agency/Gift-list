import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { fetchUnreadNotifications } from "@/api/notifications";
import { useAuth } from "@/session/auth-context";
import { NotificationBadgeContext } from "./notification-badge";

export function NotificationBadgeProvider({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const userId = state.status === "ready" ? state.user.id : null;
  const latest = useRef(0);
  const [result, setResult] = useState<{ userId: string; count: number } | null>(null);

  const refresh = useCallback(function refreshBadge() {
    if (!userId) return;
    const request = ++latest.current;
    void fetchUnreadNotifications().then(function update(data) {
      if (data && request === latest.current) setResult({ userId, count: data.unread });
    });
  }, [userId]);

  const invalidate = useCallback(function ignoreOldSession() {
    latest.current++;
  }, []);

  useEffect(function refreshOnSession() {
    refresh();
    if (!userId) return;
    const timer = setInterval(refresh, 60_000);
    return function stopPolling() {
      clearInterval(timer);
      invalidate();
    };
  }, [refresh, userId, invalidate]);

  return (
    <NotificationBadgeContext.Provider value={{ count: result?.userId === userId ? result?.count ?? 0 : 0, refresh }}>
      {children}
    </NotificationBadgeContext.Provider>
  );
}

NotificationBadgeProvider.displayName = "NotificationBadgeProvider";
