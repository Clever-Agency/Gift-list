import { notificationPreferencesPatchSchema } from "@gift-list/contracts";
import { NOTIFICATION_AUTH_REQUIRED, notificationUserId } from "@/actions/notifications";
import { parseJsonBody, toResponse } from "@/lib/api-v1";
import { notificationPreferences, updateNotificationPreferences } from "@/lib/notification-store";

export async function GET(request: Request) {
  const userId = await notificationUserId(request);
  if (!userId) return toResponse(NOTIFICATION_AUTH_REQUIRED);
  return toResponse({ ok: true, data: await notificationPreferences(userId) });
}

export async function PATCH(request: Request) {
  const userId = await notificationUserId(request);
  if (!userId) return toResponse(NOTIFICATION_AUTH_REQUIRED);
  const result = await parseJsonBody(request, notificationPreferencesPatchSchema);
  if (!result.ok) return toResponse(result);
  return toResponse({ ok: true, data: await updateNotificationPreferences(userId, result.data) });
}
