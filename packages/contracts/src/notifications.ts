import { z } from "zod";

const person = { personName: z.string(), personNick: z.string() };
const holder = { holderName: z.string().optional() };
const wish = { giftId: z.string(), titleSnapshot: z.string() };
const phase = { actionable: z.boolean() };

export const notificationPayloadSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("FRIEND_INVITE"), ...person }),
  z.object({ kind: z.literal("FRIEND_ACCEPT"), ...person }),
  z.object({ kind: z.literal("FRIEND_REJECT"), ...person }),
  z.object({ kind: z.literal("RESERVATION_CREATED"), ...wish, ...holder }),
  z.object({ kind: z.literal("RESERVATION_RELEASED"), ...wish, ...holder, role: z.enum(["owner", "holder"]) }),
  z.object({ kind: z.literal("RESERVATION_DUE"), ...wish, ...phase, bought: z.boolean().optional() }),
  z.object({ kind: z.literal("RESERVATION_OWNER_ASK"), ...wish, ...holder, ...phase }),
  z.object({ kind: z.literal("RESERVATION_KEPT_BY_OWNER"), ...wish, dueAt: z.iso.datetime(), timeZone: z.string() }),
  z.object({ kind: z.literal("RESERVATION_AUTO_RELEASE"), ...wish, ...holder }),
  z.object({ kind: z.literal("GIFT_EDITED"), ...wish, fields: z.array(z.enum(["title", "description", "linkUrl", "price"])) }),
  z.object({ kind: z.literal("GIFT_DELETED"), ...wish }),
  z.object({ kind: z.literal("GIFT_CLOSED"), ...wish }),
  z.object({ kind: z.literal("GIFT_GIVEN"), ...wish, ...holder, ...phase }),
  z.object({ kind: z.literal("DATE_FRIEND"), ...person, date: z.string() }),
  z.object({ kind: z.literal("DATE_OWN") }),
  z.object({ kind: z.literal("SUGGESTION"), senderName: z.string().optional() }),
  z.object({ kind: z.literal("WISH_EXPIRY_SOON"), ...wish }),
  z.object({ kind: z.literal("WISH_EXPIRY"), ...wish }),
]);

const genericEvent = z.object({ kind: z.literal("UNKNOWN") });
export const notificationItemSchema = z.object({
  id: z.string(),
  createdAt: z.iso.datetime(),
  readAt: z.iso.datetime().nullable(),
  href: z.string().nullable(),
  event: z.union([notificationPayloadSchema, genericEvent]).catch({ kind: "UNKNOWN" }),
});
export const notificationUnreadSchema = z.object({ unread: z.int().nonnegative() });
export const notificationFeedSchema = z.object({
  items: z.array(notificationItemSchema),
  nextCursor: z.string().nullable(),
});
export const notificationPreferencesSchema = z.object({
  datesInApp: z.boolean(),
  datesEmail: z.boolean(),
  wishExpiryInApp: z.boolean(),
  wishExpiryEmail: z.boolean(),
});
export const notificationPreferencesPatchSchema = notificationPreferencesSchema.partial().strict();
export const notificationActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("received") }),
  z.object({ action: z.literal("keep") }),
  z.object({ action: z.literal("release") }),
  z.object({ action: z.literal("bought") }),
  z.object({ action: z.literal("clearBought") }),
  z.object({ action: z.literal("extend"), dueOn: z.iso.date() }),
]);

export type NotificationPayload = z.infer<typeof notificationPayloadSchema>;
export type NotificationItem = z.infer<typeof notificationItemSchema>;
export type NotificationFeed = z.infer<typeof notificationFeedSchema>;
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;
export type NotificationAction = z.infer<typeof notificationActionSchema>;
