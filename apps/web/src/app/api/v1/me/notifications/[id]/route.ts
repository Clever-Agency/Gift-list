import { notificationActionSchema } from "@gift-list/contracts";
import {
  actOnNotification,
  NOTIFICATION_AUTH_REQUIRED,
  NOTIFICATION_NOT_FOUND,
  notificationUserId,
} from "@/actions/notifications";
import { parseJsonBody, toResponse } from "@/lib/api-v1";
import { markNotificationRead, readNotification } from "@/lib/notification-store";

export async function GET(request: Request, context: RouteContext<"/api/v1/me/notifications/[id]">) {
  const userId = await notificationUserId(request);
  if (!userId) return toResponse(NOTIFICATION_AUTH_REQUIRED);
  const { id } = await context.params;
  const item = await readNotification(userId, id);
  return toResponse(item ? { ok: true, data: item } : NOTIFICATION_NOT_FOUND);
}

export async function PATCH(request: Request, context: RouteContext<"/api/v1/me/notifications/[id]">) {
  const userId = await notificationUserId(request);
  if (!userId) return toResponse(NOTIFICATION_AUTH_REQUIRED);
  const { id } = await context.params;
  if (!await markNotificationRead(userId, id)) return toResponse(NOTIFICATION_NOT_FOUND);
  return toResponse({ ok: true, data: { id } });
}

export async function POST(request: Request, context: RouteContext<"/api/v1/me/notifications/[id]">) {
  const userId = await notificationUserId(request);
  if (!userId) return toResponse(NOTIFICATION_AUTH_REQUIRED);
  const input = await parseJsonBody(request, notificationActionSchema);
  if (!input.ok) return toResponse(input);
  const { id } = await context.params;
  return toResponse(await actOnNotification(userId, id, input.data));
}
