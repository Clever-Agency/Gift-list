import {
  notificationFeedSchema,
  notificationItemSchema,
  notificationPreferencesSchema,
  notificationUnreadSchema,
  type NotificationAction,
  type NotificationPreferences,
} from "@gift-list/contracts";
import { apiRequest } from "@/api/client";

const path = "/api/v1/me/notifications";

export async function fetchNotifications(cursor?: string) {
  return read(path + (cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""), notificationFeedSchema);
}

export async function fetchNotification(id: string) {
  return read(`${path}/${encodeURIComponent(id)}`, notificationItemSchema);
}

export async function fetchUnreadNotifications() {
  return read(`${path}/unread`, notificationUnreadSchema);
}

export async function fetchNotificationPreferences() {
  return read(`${path}/preferences`, notificationPreferencesSchema);
}

export type SaveNotificationPreferencesResult =
  | { ok: true; data: NotificationPreferences }
  | { ok: false; network: boolean };

export async function saveNotificationPreferences(
  body: Partial<NotificationPreferences>,
): Promise<SaveNotificationPreferencesResult> {
  const response = await apiRequest<unknown>(`${path}/preferences`, { method: "PATCH", body });
  if (!response.ok) return { ok: false, network: "network" in response };
  const parsed = notificationPreferencesSchema.safeParse(response.data);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, network: false };
}

export function markNotificationRead(id: string) {
  return apiRequest<unknown>(`${path}/${encodeURIComponent(id)}`, { method: "PATCH" });
}

export function submitNotificationAction(id: string, body: NotificationAction) {
  return apiRequest<unknown>(`${path}/${encodeURIComponent(id)}`, { method: "POST", body });
}

async function read<T>(url: string, schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } }): Promise<T | null> {
  const response = await apiRequest<unknown>(url);
  if (!response.ok) return null;
  const parsed = schema.safeParse(response.data);
  return parsed.success ? parsed.data : null;
}
