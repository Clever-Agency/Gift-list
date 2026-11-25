import { z } from "zod";

const person = { personName: z.string(), personNick: z.string() };
const holder = { holderName: z.string().optional() };
const wish = { giftId: z.string(), titleSnapshot: z.string() };
const phase = { actionable: z.boolean() };

/**
 * CLE-124/S9b-2: the release window of a reservation counts from its deadline.
 * A `RESERVATION_DUE` payload carries the deadline so the client can name the
 * release date itself (AD-27: no formatted dates on the wire).
 */
export const RESERVATION_RELEASE_AFTER_MS = 168 * 60 * 60 * 1000;

export const notificationPayloadSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("FRIEND_INVITE"), ...person }),
  z.object({ kind: z.literal("FRIEND_ACCEPT"), ...person }),
  z.object({ kind: z.literal("FRIEND_REJECT"), ...person }),
  z.object({ kind: z.literal("RESERVATION_CREATED"), ...wish, ...holder }),
  z.object({ kind: z.literal("RESERVATION_RELEASED"), ...wish, ...holder, role: z.enum(["owner", "holder"]) }),
  z.object({ kind: z.literal("RESERVATION_DUE"), ...wish, ...phase, bought: z.boolean().optional(),
    /**
     * CLE-124/S9b-2: the stored deadline (exclusive end of the chosen day) and
     * its zone. The expiry notice names `dueAt + 168 ч` as the release moment;
     * the reminder before the deadline names the day itself. Both keys are
     * optional so a row written before the change still renders.
     */
    dueAt: z.iso.datetime().optional(), timeZone: z.string().optional(),
    /** `true` — the reminder 1–2 days before the deadline; absent — the expiry notice. */
    reminder: z.boolean().optional() }),
  z.object({ kind: z.literal("RESERVATION_OWNER_ASK"), ...wish, ...holder, ...phase }),
  z.object({ kind: z.literal("RESERVATION_KEPT_BY_OWNER"), ...wish, dueAt: z.iso.datetime(), timeZone: z.string() }),
  z.object({ kind: z.literal("RESERVATION_AUTO_RELEASE"), ...wish, ...holder }),
  z.object({ kind: z.literal("GIFT_EDITED"), ...wish, fields: z.array(z.enum(["title", "description", "linkUrl", "price"])) }),
  z.object({ kind: z.literal("GIFT_DELETED"), ...wish }),
  z.object({ kind: z.literal("GIFT_CLOSED"), ...wish }),
  /**
   * CLE-124/S9b-2: «Подарил» moves the reservation into `GIVEN`. The owner gets
   * one general e-mail with no title, no holder and no action, so the payload
   * carries nothing but the kind.
   */
  z.object({ kind: z.literal("GIFT_GIVEN") }),
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
  /** CLE-124/S9b-2: the holder's «Подарил» from a reservation notification. */
  z.object({ action: z.literal("given") }),
  z.object({ action: z.literal("extend"), dueOn: z.iso.date() }),
]);

export type NotificationPayload = z.infer<typeof notificationPayloadSchema>;
export type NotificationItem = z.infer<typeof notificationItemSchema>;
export type NotificationFeed = z.infer<typeof notificationFeedSchema>;
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;
export type NotificationAction = z.infer<typeof notificationActionSchema>;
