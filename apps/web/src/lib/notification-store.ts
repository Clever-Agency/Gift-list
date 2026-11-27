import "server-only";

import {
  notificationPayloadSchema,
  type NotificationFeed,
  type NotificationItem,
  type NotificationPreferences,
} from "@gift-list/contracts";
import { prisma } from "@/db/client";
import type { Notification, NotificationKind, Prisma } from "@/db/generated/client";
import { calendarDay } from "@/domain/calendar-day";
import type { GiftEditEventField } from "@/domain/gift-edit";
import { GIVABLE_RESERVATION_PHASES, UNDO_WINDOW_MS } from "@/domain/gift-status";
import { VisibilityPolicy } from "@/domain/visibility";
import { relationshipReader } from "@/lib/relationships";
import { canonicalTimeZone } from "@/lib/time-zone";
import type { UnsubscribeType } from "@/lib/unsubscribe-token";

type Tx = Prisma.TransactionClient;
type GiftEventKind = Exclude<NotificationKind,
  "FRIEND_INVITE" | "FRIEND_ACCEPT" | "FRIEND_REJECT" | "DATE_FRIEND" | "DATE_OWN" | "SUGGESTION">;

const giftSelect = {
  id: true,
  title: true,
  expiresOn: true,
  archivedAt: true,
  visibility: true,
  status: true,
  reservedAt: true,
  reservedById: true,
  // Story 6.6: the holder's own calendar day decides the «скоро» notice.
  reservedBy: { select: { timeZone: true } },
  reservationPhase: true,
  reservationPhaseAt: true,
  reservationBought: true,
  reservationDueAt: true,
  reservationTimeZone: true,
  titleSnapshotOnReserve: true,
  list: { select: { ownerId: true, owner: { select: { nick: true } } } },
} satisfies Prisma.GiftSelect;

type GiftSnapshot = Prisma.GiftGetPayload<{ select: typeof giftSelect }>;

export const preferenceSelect = {
  datesInApp: true,
  datesEmail: true,
  wishExpiryInApp: true,
  wishExpiryEmail: true,
  // CLE-137 (FR-36): reminder type switches live with the channels.
  remindFriendDates: true,
  remindOwnList: true,
} satisfies Prisma.UserSelect;

export function notificationGiftSnapshot(db: Pick<Tx, "gift">, id: string) {
  return db.gift.findUnique({ where: { id }, select: giftSelect });
}

export async function enqueueNotification(tx: Tx, data: Prisma.NotificationCreateManyInput) {
  return tx.notification.createMany({ data, skipDuplicates: true });
}

export async function enqueueFriendNotification(
  tx: Tx,
  kind: "FRIEND_INVITE" | "FRIEND_ACCEPT" | "FRIEND_REJECT",
  eventId: string,
  actorId: string,
  recipientId: string,
  at = new Date(),
) {
  await enqueueNotification(tx, {
    eventKey: `${kind}:${eventId}`,
    kind,
    actorId,
    recipientId,
    createdAt: at,
    deliverAfter: at,
    payload: {},
  });
}

type GiftNotification = {
  kind: GiftEventKind;
  role: "owner" | "holder";
  email: boolean;
  at: Date;
  fields?: readonly GiftEditEventField[];
  /**
   * CLE-124/S9b-2: the stable moment of the event for `eventKey`. The reminder
   * has no write of its own, so it anchors its key on the deadline: a repeated
   * cron run and a new run over the same deadline are one row.
   */
  eventAt?: Date;
  /** CLE-124/S9b-2: `true` for the reminder before the deadline. */
  reminder?: boolean;
  /**
   * Story 6.6: `WISH_EXPIRY` tells the holder whether the reservation was
   * released (`true`) or kept because the gift is marked as bought (`false`).
   * Absent means the flag never reaches the payload; rows written before the
   * change are read as released.
   */
  released?: boolean;
};

/**
 * CLE-124/S9b-2 fix: the reminder before the deadline and «Срок истёк» are both
 * `RESERVATION_DUE` for the same gift and both anchor on the deadline, so a run
 * exactly at the deadline would give them one key and `skipDuplicates` would
 * silently drop the deadline notice. The reminder therefore names itself in the
 * key; every other kind keeps the plain `kind:giftId:at` shape.
 */
function giftEventKey(kind: GiftEventKind, giftId: string, at: Date, reminder = false) {
  return reminder ? `${kind}:reminder:${giftId}:${at.toISOString()}` : `${kind}:${giftId}:${at.toISOString()}`;
}

type WishExpiryKind = "WISH_EXPIRY_SOON" | "WISH_EXPIRY";

/**
 * Story 6.6: the wish-expiry notices run every cron hour, so their key cannot
 * carry the run moment. The reservation instance (`reservedAt`) and the expiry
 * day tell one notice from another: a repeated run adds nothing
 * (`skipDuplicates`), while a re-reserved wish or a moved `expiresOn` gets its
 * own notice. The key deliberately omits the `released` variant: one
 * reservation and one expiry day produce one notice, whichever variant the
 * first run wrote.
 */
export function wishExpiryEventKey(
  kind: WishExpiryKind,
  giftId: string,
  reservedAt: Date,
  expiresOn: Date | null,
): string {
  const day = expiresOn === null ? null : calendarDay(expiresOn);
  return `${kind}:${giftId}:${reservedAt.toISOString()}:${day ?? "none"}`;
}

export async function enqueueGiftNotification(
  tx: Tx,
  gift: GiftSnapshot | null,
  { kind, role, email, at, fields, eventAt, reminder, released }: GiftNotification,
) {
  if (!gift?.reservedAt || !gift.reservedById) return 0;
  const recipientId = role === "owner" ? gift.list.ownerId : gift.reservedById;
  const payload = {
    role,
    titleSnapshot: role === "holder" ? gift.titleSnapshotOnReserve : gift.title,
    ...(kind === "RESERVATION_KEPT_BY_OWNER" && gift.reservationDueAt
      ? { dueAt: gift.reservationDueAt.toISOString(), timeZone: canonicalTimeZone(gift.reservationTimeZone) }
      : {}),
    // CLE-124/S9b-2: the deadline notice and the reminder name their dates on
    // the client (AD-27), so both carry the stored deadline and its zone.
    ...(kind === "RESERVATION_DUE" && gift.reservationDueAt
      ? { dueAt: gift.reservationDueAt.toISOString(), timeZone: canonicalTimeZone(gift.reservationTimeZone) }
      : {}),
    ...(kind === "RESERVATION_DUE" && reminder === true ? { reminder: true } : {}),
    // Story 6.6: only `WISH_EXPIRY` has the two variants; the flag is omitted
    // when the caller does not name one, so the payload stays compatible.
    ...(kind === "WISH_EXPIRY" && released !== undefined ? { released } : {}),
    ...(fields ? { fields: [...fields] } : {}),
  };
  const eventKey = kind === "WISH_EXPIRY_SOON" || kind === "WISH_EXPIRY"
    ? wishExpiryEventKey(kind, gift.id, gift.reservedAt, gift.expiresOn)
    : giftEventKey(kind, gift.id, eventAt ?? at, reminder === true);
  // Story 6.6: the number of rows actually written. `skipDuplicates` turns a
  // repeated wish-expiry notice into `0`, so a cron run can tell "queued now"
  // from "already queued" without a second read.
  const { count } = await enqueueNotification(tx, {
    eventKey,
    kind,
    giftId: gift.id,
    actorId: role === "owner" ? gift.reservedById : gift.list.ownerId,
    reservationAt: gift.reservedAt,
    phaseAt: gift.reservationPhaseAt,
    recipientId,
    createdAt: at,
    deliverAfter: kind === "GIFT_CLOSED" ? new Date(at.getTime() + UNDO_WINDOW_MS) : at,
    emailRequired: email,
    payload,
  });
  return count;
}

/**
 * CLE-124/S9b-2 (Story 5.7): the owner's one general e-mail after «Подарил».
 * It names no wish, no holder and no gift id, is not actionable and never
 * appears in the in-app feed; only the e-mail channel delivers it. The key is
 * the UTC day, so several gifts marked on one day do not spam the owner with
 * identical letters — the task allows this deduplication.
 */
export async function enqueueGiftGivenNotice(tx: Tx, ownerId: string, at: Date) {
  const day = at.toISOString().slice(0, 10);
  await enqueueNotification(tx, {
    eventKey: `GIFT_GIVEN:${day}`,
    kind: "GIFT_GIVEN",
    recipientId: ownerId,
    createdAt: at,
    deliverAfter: at,
    emailRequired: true,
    payload: {},
  });
}

// Both closure undo and its mail claim take Gift first, then Notification.
export async function lockClosureGift(tx: Tx, giftId: string) {
  const [gift] = await tx.$queryRaw<{ status: string; closedAt: Date | null }[]>`
    SELECT status::text AS status, "closedAt" FROM "Gift" WHERE id = ${giftId} FOR UPDATE
  `;
  // A separate statement reads the clock after LockRows has finished waiting.
  const [clock] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
  return { gift, now: clock!.now };
}

export async function cancelCloseNotification(tx: Tx, giftId: string, closedAt: Date) {
  await tx.notification.deleteMany({ where: { eventKey: giftEventKey("GIFT_CLOSED", giftId, closedAt) } });
}

/**
 * CLE-137 (FR-36): a date reminder leaves only while its own type switch and
 * its channel are both on. Other kinds ignore the type switches.
 */
export function notificationChannelEnabled(
  kind: NotificationKind,
  prefs: NotificationPreferences,
  channel: "inApp" | "email",
) {
  const inApp = channel === "inApp";
  if (kind === "DATE_FRIEND") {
    return prefs.remindFriendDates && (inApp ? prefs.datesInApp : prefs.datesEmail);
  }
  if (kind === "DATE_OWN") {
    return prefs.remindOwnList && (inApp ? prefs.datesInApp : prefs.datesEmail);
  }
  if (kind === "WISH_EXPIRY_SOON" || kind === "WISH_EXPIRY") {
    return inApp ? prefs.wishExpiryInApp : prefs.wishExpiryEmail;
  }
  return true;
}

/**
 * Story 6.6: the wish-expiry notice offers «Подарил» only in its kept variant
 * (`released: false`) and only while that same reservation is live and givable
 * for its holder. Any release, archive, re-reservation or `GIVEN` phase turns
 * the control off, exactly like a stale `RESERVATION_DUE` row. The released
 * variant has no action at all.
 */
function wishExpiryIsActionable(row: Notification, gift: GiftSnapshot | null): boolean {
  const payload = row.payload;
  const released = payload !== null && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as { released?: unknown }).released
    : undefined;
  if (released !== false) return false;
  return Boolean(
    gift?.status === "RESERVED" && !gift.archivedAt &&
    gift.reservedById === row.recipientId && row.reservationAt &&
    row.reservationAt.getTime() === gift.reservedAt?.getTime() &&
    gift.reservationPhase !== null &&
    (GIVABLE_RESERVATION_PHASES as readonly string[]).includes(gift.reservationPhase),
  );
}

export function notificationIsActionable(row: Notification, gift: GiftSnapshot | null) {
  if (row.kind === "WISH_EXPIRY") return wishExpiryIsActionable(row, gift);
  const payload = row.payload;
  const reminder = row.kind === "RESERVATION_DUE" && payload !== null &&
    typeof payload === "object" && !Array.isArray(payload) &&
    (payload as { reminder?: unknown }).reminder === true;
  const phase = row.kind === "RESERVATION_DUE" ? (reminder ? "ACTIVE" : "AWAITING_GIVER") : null;
  const ownsAction = row.kind === "RESERVATION_DUE" && gift?.reservedById === row.recipientId;
  return Boolean(
    phase && gift?.status === "RESERVED" && !gift.archivedAt && ownsAction &&
    gift.reservationPhase === phase && row.reservationAt && row.phaseAt &&
    row.reservationAt.getTime() === gift.reservedAt?.getTime() &&
    row.phaseAt.getTime() === gift.reservationPhaseAt?.getTime(),
  );
}

/**
 * CLE-124: a wish's reservation is a surprise for its owner. The owner must not
 * learn about a reservation, its release, the owner phase or its automatic
 * release, so rows addressed to them are hidden from every read path.
 *
 * The rule covers rows already written before the change, which is why it lives
 * here and the rows stay in the database: `RESERVATION_CREATED` and
 * `RESERVATION_OWNER_ASK` are owner-only kinds (the enum value of the latter
 * stays in the schema for those rows), while the two release kinds also go to
 * the holder and are hidden for the owner by their payload.
 */
export function isHiddenOwnerReservationNotification(
  row: Pick<Notification, "kind" | "payload">,
): boolean {
  if (row.kind === "RESERVATION_CREATED" || row.kind === "RESERVATION_OWNER_ASK") return true;
  const ownerAddressed = row.kind === "RESERVATION_RELEASED" ||
    row.kind === "RESERVATION_AUTO_RELEASE" ||
    // Story 6.6 (D-49): the wish-expiry notice is holder-only as well.
    row.kind === "WISH_EXPIRY_SOON" || row.kind === "WISH_EXPIRY";
  if (!ownerAddressed) return false;
  const payload = row.payload;
  return payload !== null && typeof payload === "object" && !Array.isArray(payload) &&
    (payload as { role?: unknown }).role === "owner";
}

export async function projectNotification(
  row: Notification,
  prefs: NotificationPreferences,
  channel: "inApp" | "email",
  now = new Date(),
): Promise<NotificationItem | null> {
  if (isHiddenOwnerReservationNotification(row)) return null;
  // CLE-124/S9b-2: «Подарил» sends the owner one general e-mail and writes no
  // in-app notification. The row stays addressable through its e-mail link.
  if (row.kind === "GIFT_GIVEN" && channel === "inApp") return null;
  if (row.deliverAfter > now || !notificationChannelEnabled(row.kind, prefs, channel)) return null;
  const raw = row.payload;
  const payload = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  let href: string | null = null;
  let data: object = payload;

  if (row.kind === "FRIEND_INVITE" || row.kind === "FRIEND_ACCEPT" || row.kind === "FRIEND_REJECT") {
    if (!row.actorId || (await relationshipReader.relationsBetween(row.recipientId, row.actorId)).blocked) return null;
    const person = await prisma.user.findUnique({ where: { id: row.actorId }, select: { name: true, nick: true } });
    if (!person?.nick) return null;
    data = { personName: person.name, personNick: person.nick };
    href = `/u/${person.nick}`;
  } else if (row.giftId) {
    const gift = await notificationGiftSnapshot(prisma, row.giftId);
    const holderSnapshot = payload.role === "holder" && row.reservationAt !== null;
    const ownerId = gift?.list.ownerId ?? (holderSnapshot ? row.actorId : null);
    if (!ownerId) return null;
    const relations = await relationshipReader.relationsBetween(row.recipientId, ownerId);
    const visible = gift && VisibilityPolicy.canSee(
      { id: row.recipientId },
      { ...relations, viaListToken: false },
      { ownerId, visibility: gift.visibility, archivedAt: gift.archivedAt },
    );
    if (!visible && !holderSnapshot) return null;

    const sameReservation = Boolean(gift?.reservedAt && row.reservationAt &&
      gift.reservedAt.getTime() === row.reservationAt.getTime());
    const actionable = notificationIsActionable(row, gift);
    // CLE-124/D-49: the holder's name never reaches the owner. A legacy payload
    // may still carry `holderName` from before the change, so it is dropped here
    // for every recipient rather than trusted.
    const { holderName: _legacyHolderName, ...rest } = payload;
    void _legacyHolderName;
    data = {
      ...rest,
      giftId: row.giftId,
      actionable,
      // The payload is historical. The purchase mark is live and holder-only.
      bought: row.kind === "RESERVATION_DUE" && actionable ? gift?.reservationBought : undefined,
    };
    if (visible && gift) {
      href = gift.list.ownerId === row.recipientId ? `/gifts/${row.giftId}` :
        gift.list.owner.nick ? `/u/${gift.list.owner.nick}` : null;
    } else if (gift && sameReservation && gift.status === "RESERVED" && gift.reservedById === row.recipientId) {
      href = "/reservations";
    }
  } else if (row.kind === "DATE_OWN") {
    // Story 7.4 (FR-35): the owner's own birthday reminder opens «Мой вишлист»,
    // the app's main owner screen (`/`). The payload stays empty.
    href = "/";
  } else if (row.kind === "DATE_FRIEND") {
    // Story 7.3 (FR-34, AD-7, AD-29): the birthday is visible only to an
    // accepted Friend whose profile switch is still on. A block, a lost
    // friendship or a switched-off profile hides a row written earlier.
    if (!row.actorId) return null;
    const relations = await relationshipReader.relationsBetween(row.recipientId, row.actorId);
    if (relations.blocked || !relations.friend) return null;
    const friend = await prisma.user.findUnique({
      where: { id: row.actorId },
      select: { name: true, nick: true, profileVisibleToFriends: true },
    });
    if (!friend?.nick || !friend.profileVisibleToFriends) return null;
    const values = payload as Record<string, unknown>;
    if (typeof values.date !== "string") return null;
    // Only the summary keys of the payload reach the client: no holder, no
    // reservation phase and no status can travel with a birthday reminder.
    const count = typeof values.count === "number" && Number.isInteger(values.count) && values.count >= 0
      ? values.count
      : undefined;
    const titles = Array.isArray(values.titles)
      ? values.titles.filter((title): title is string => typeof title === "string").slice(0, 3)
      : undefined;
    data = {
      personName: friend.name,
      personNick: friend.nick,
      date: values.date,
      ...(count === undefined ? {} : { count }),
      ...(titles === undefined ? {} : { titles }),
    };
    href = `/u/${friend.nick}`;
  }

  const parsed = notificationPayloadSchema.safeParse({ ...data, kind: row.kind });
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt?.toISOString() ?? null,
    href,
    event: parsed.success ? parsed.data : { kind: "UNKNOWN" },
  };
}

export function notificationPreferences(userId: string) {
  return prisma.user.findUniqueOrThrow({ where: { id: userId }, select: preferenceSelect });
}

export function updateNotificationPreferences(userId: string, data: Partial<NotificationPreferences>) {
  return prisma.user.update({ where: { id: userId }, data, select: preferenceSelect });
}

/**
 * CLE-137 (Story 7.2, FR-36): the only write an unsubscribe token may make.
 * `updateMany` answers `0` for a deleted account instead of throwing, so the
 * page can give the same neutral answer as for a bad token.
 */
export function setReminderSwitch(userId: string, type: UnsubscribeType, enabled: boolean) {
  return prisma.user.updateMany({
    where: { id: userId },
    data: type === "friendDates" ? { remindFriendDates: enabled } : { remindOwnList: enabled },
  });
}

const PAGE_SIZE = 30;
const PROJECTION_CONCURRENCY = 8;

function notificationWindow(
  userId: string, now: Date, after: Pick<Notification, "createdAt" | "id"> | null, unreadOnly = false,
) {
  return prisma.notification.findMany({
    where: {
      recipientId: userId,
      deliverAfter: { lte: now },
      ...(unreadOnly ? { readAt: null } : {}),
      ...(after ? {
        OR: [
          { createdAt: { lt: after.createdAt } },
          { createdAt: after.createdAt, id: { lt: after.id } },
        ],
      } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE,
  });
}

async function projectWindow(rows: Notification[], prefs: NotificationPreferences, now: Date) {
  const items: NotificationItem[] = [];
  for (let start = 0; start < rows.length; start += PROJECTION_CONCURRENCY) {
    const projected = await Promise.all(rows.slice(start, start + PROJECTION_CONCURRENCY).map(function project(row) {
      return projectNotification(row, prefs, "inApp", now);
    }));
    for (const item of projected) if (item) items.push(item);
  }
  return items;
}

export async function countUnreadNotifications(userId: string) {
  const now = new Date();
  const prefs = await notificationPreferences(userId);
  let after: Notification | null = null;
  let unread = 0;
  for (;;) {
    const rows = await notificationWindow(userId, now, after, true);
    unread += (await projectWindow(rows, prefs, now)).length;
    if (rows.length < PAGE_SIZE) return unread;
    after = rows[rows.length - 1]!;
  }
}

export async function readNotifications(userId: string, cursor?: string): Promise<NotificationFeed> {
  const now = new Date();
  const prefs = await notificationPreferences(userId);
  const items: NotificationItem[] = [];
  let after = cursor
    ? await prisma.notification.findFirst({ where: { id: cursor, recipientId: userId } })
    : null;
  if (cursor && !after) return { items, nextCursor: null };

  for (;;) {
    const rows = await notificationWindow(userId, now, after);
    items.push(...await projectWindow(rows, prefs, now));
    if (items.length > PAGE_SIZE) return { items: items.slice(0, PAGE_SIZE), nextCursor: items[PAGE_SIZE - 1]!.id };
    if (rows.length < PAGE_SIZE) return { items, nextCursor: null };
    after = rows[rows.length - 1]!;
  }
}

export async function readNotification(userId: string, id: string) {
  const row = await prisma.notification.findFirst({ where: { id, recipientId: userId } });
  if (!row) return null;
  const prefs = await notificationPreferences(userId);
  const item = await projectNotification(row, prefs, "inApp");
  // A notification reached from email remains addressable for its recipient
  // when their in-app channel is disabled. It stays out of the feed and count.
  return item ?? (row.emailRequired ? projectNotification(row, prefs, "email") : null);
}

export async function markNotificationRead(userId: string, id: string) {
  if (!await readNotification(userId, id)) return false;
  await prisma.notification.updateMany({ where: { id, recipientId: userId, readAt: null }, data: { readAt: new Date() } });
  return true;
}
