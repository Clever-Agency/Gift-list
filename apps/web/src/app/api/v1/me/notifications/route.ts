import { NOTIFICATION_AUTH_REQUIRED, notificationUserId } from "@/actions/notifications";
import { toResponse } from "@/lib/api-v1";
import { readNotifications } from "@/lib/notification-store";

export async function GET(request: Request) {
  const userId = await notificationUserId(request);
  if (!userId) return toResponse(NOTIFICATION_AUTH_REQUIRED);
  const cursor = new URL(request.url).searchParams.get("cursor") ?? undefined;
  return toResponse({ ok: true, data: await readNotifications(userId, cursor) });
}
