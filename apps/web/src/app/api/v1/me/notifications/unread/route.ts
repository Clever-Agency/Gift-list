import { NOTIFICATION_AUTH_REQUIRED, notificationUserId } from "@/actions/notifications";
import { toResponse } from "@/lib/api-v1";
import { countUnreadNotifications } from "@/lib/notification-store";

export async function GET(request: Request) {
  const userId = await notificationUserId(request);
  if (!userId) return toResponse(NOTIFICATION_AUTH_REQUIRED);
  const unread = await countUnreadNotifications(userId);
  return toResponse({ ok: true, data: { unread } });
}
